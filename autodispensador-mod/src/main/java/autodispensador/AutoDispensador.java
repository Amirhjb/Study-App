package autodispensador;

import com.mojang.blaze3d.platform.InputConstants;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.recipebook.RecipeCollection;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.util.context.ContextMap;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.CraftingMenu;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.crafting.display.RecipeDisplayEntry;
import net.minecraft.world.item.crafting.display.ShapedCraftingRecipeDisplay;
import net.minecraft.world.item.crafting.display.ShapelessCraftingRecipeDisplay;
import net.minecraft.world.item.crafting.display.SlotDisplay;
import net.minecraft.world.item.crafting.display.SlotDisplayContext;
import org.lwjgl.glfw.GLFW;

import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

/**
 * Solo cliente: con una mesa de crafteo abierta, hace los clics por ti para craftear el objeto elegido.
 * Coloca los ingredientes como harías a mano (también arcos gastados, que el libro de recetas no usa),
 * así que funciona en servidores sin instalar nada en ellos. K abre el menú.
 */
public class AutoDispensador implements ClientModInitializer {
	private static final Path CONFIG = FabricLoader.getInstance().getConfigDir().resolve("autodispensador.properties");

	// Huecos del CraftingMenu: 0 = resultado, 1-9 = rejilla 3x3, 10-36 = inventario principal,
	// 37-45 = barra rápida (esa no se limpia nunca, ahí guardas lo tuyo).
	private static final int RESULTADO = 0, FIN_PRINCIPAL = 37, HUECOS_PRINCIPAL = 27;

	/** Un ingrediente de la receta: en qué huecos de la rejilla va y qué objetos valen. */
	record Grupo(String clave, Component nombre, List<Integer> huecos, Set<Item> items, int cupoPorDefecto) {}
	record Receta(String objetivo, Component nombre, List<Grupo> grupos, boolean[] usados) {}
	record Opcion(String clave, Component nombre) {}

	boolean activo = true;
	String objetivo = "minecraft:dispenser";
	int intervalo = 10; // ticks entre crafteos (20 ticks = 1 segundo)
	int reserva = 1; // cuántos de cada ingrediente se dejan siempre en el inventario
	boolean tirar = true; // tirar el resultado (si no, se guarda; si no cabe, se tira igual)
	boolean limpiar = true; // tirar del inventario principal lo que no sea ingrediente o pase de su cupo
	private final Map<String, Integer> cupos = new HashMap<>(); // "objetivo|ingrediente" -> huecos

	private int espera = 0; // ticks desde el último crafteo
	private int atascado = 0; // ticks con algo en el cursor
	private Receta receta;
	private Object nivelReceta;
	private int reintento = 20;

	@Override
	public void onInitializeClient() {
		cargar();
		KeyMapping tecla = KeyMappingHelper.registerKeyMapping(new KeyMapping(
				"key.autodispensador.menu", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_K, KeyMapping.Category.MISC));

		ClientTickEvents.END_CLIENT_TICK.register(mc -> {
			while (tecla.consumeClick()) {
				if (mc.player != null) mc.setScreen(new Menu(this, opciones(mc)));
			}
			if (activo) craftear(mc);
		});
	}

	/** Se llama cada tick: rellena en cuanto puede y saca un resultado cada {@code intervalo} ticks. */
	private void craftear(Minecraft mc) {
		if (mc.player == null || mc.gameMode == null || mc.level == null) return;
		if (!(mc.player.containerMenu instanceof CraftingMenu menu)) return;
		Receta r = receta(mc);
		if (r == null) {
			aviso(mc, "no conozco la receta de " + objetivo + " (desbloquéala en el libro de recetas)");
			return;
		}

		// Algo en el cursor durante medio segundo (desincronización con el servidor, p. ej. recogiste algo
		// justo en el hueco que el mod acababa de vaciar): se devuelve al inventario y se sigue.
		if (!menu.getCarried().isEmpty()) {
			if (++atascado < 10) return;
			soltarCursor(mc, menu);
		}
		atascado = 0;

		// Primero saca el resultado ya listo y luego rellena para el siguiente
		// (el servidor calcula el resultado, así que tarda un tick en aparecer).
		ItemStack resultado = menu.getSlot(RESULTADO).getItem();
		if (++espera >= intervalo && !resultado.isEmpty()) {
			input(mc, menu, RESULTADO, 0, tirar || !cabe(menu, resultado) ? ContainerInput.THROW : ContainerInput.QUICK_MOVE);
			espera = 0;
		}

		if (limpiar) limpiar(mc, menu, r);
		for (int h = 1; h <= 9; h++) {
			if (!r.usados()[h] && !menu.getSlot(h).getItem().isEmpty()) {
				click(mc, menu, h, 0); // en un hueco que la receta no usa: fuera
				soltarCursor(mc, menu);
			}
		}
		for (Grupo g : r.grupos()) {
			if (!rellenar(mc, menu, g)) {
				aviso(mc, "esperando " + g.nombre().getString() + " (reserva " + reserva + ")");
				return;
			}
		}
	}

	/**
	 * Pone 1 objeto en cada hueco vacío del ingrediente, como clic derecho: coge un stack del inventario,
	 * reparte y devuelve el resto a su sitio. Si en esos huecos hay algo que no toca, lo saca.
	 * false si falta material; nunca baja del mínimo de {@code reserva} en el inventario.
	 */
	private boolean rellenar(Minecraft mc, CraftingMenu menu, Grupo g) {
		int faltan = 0;
		for (int h : g.huecos()) {
			if (!menu.getSlot(h).getItem().isEmpty() && !vale(menu.getSlot(h).getItem(), g)) {
				click(mc, menu, h, 0);
				soltarCursor(mc, menu);
			}
			if (menu.getSlot(h).getItem().isEmpty()) faltan++;
		}
		if (faltan == 0) return true;

		int disponibles = 0;
		for (int i = 10; i < menu.slots.size(); i++) {
			ItemStack s = menu.getSlot(i).getItem();
			if (vale(s, g)) disponibles += s.getCount();
		}
		if (disponibles - reserva < faltan) return false;

		for (int i = 10; i < menu.slots.size() && hayHueco(menu, g); i++) {
			if (!vale(menu.getSlot(i).getItem(), g)) continue;
			click(mc, menu, i, 0); // coger el stack
			for (int h : g.huecos()) {
				if (menu.getCarried().isEmpty()) break;
				if (menu.getSlot(h).getItem().isEmpty()) click(mc, menu, h, 1); // soltar 1
			}
			if (!menu.getCarried().isEmpty()) click(mc, menu, i, 0); // devolver el resto
		}
		return !hayHueco(menu, g);
	}

	// Los objetos encantados no se usan nunca, para no gastar tu arco bueno.
	private static boolean vale(ItemStack s, Grupo g) {
		return !s.isEmpty() && g.items().contains(s.getItem()) && !s.isEnchanted();
	}

	private static boolean hayHueco(CraftingMenu menu, Grupo g) {
		for (int h : g.huecos()) if (menu.getSlot(h).getItem().isEmpty()) return true;
		return false;
	}

	/**
	 * Inventario principal: cada ingrediente tiene su cupo de huecos (ver menú). Lo que se pase de su cupo
	 * y todo lo que no sea ingrediente (o el resultado, si no se guarda) se tira, para que siempre entre material.
	 */
	private void limpiar(Minecraft mc, CraftingMenu menu, Receta r) {
		int[] usados = new int[r.grupos().size()];
		for (int i = 10; i < FIN_PRINCIPAL; i++) {
			ItemStack s = menu.getSlot(i).getItem();
			if (s.isEmpty() || (!tirar && clave(s.getItem()).equals(r.objetivo()))) continue;
			int g = 0;
			while (g < usados.length && !vale(s, r.grupos().get(g))) g++;
			if (g == usados.length || ++usados[g] > cupo(r.grupos().get(g))) {
				input(mc, menu, i, 1, ContainerInput.THROW); // Ctrl+Q: tira el stack entero
			}
		}
	}

	private static boolean cabe(CraftingMenu menu, ItemStack resultado) {
		for (int i = 10; i < menu.slots.size(); i++) {
			ItemStack s = menu.getSlot(i).getItem();
			if (s.isEmpty() || (ItemStack.isSameItemSameComponents(s, resultado)
					&& s.getCount() + resultado.getCount() <= s.getMaxStackSize())) return true;
		}
		return false;
	}

	/** Deja lo del cursor en el inventario (juntándolo con su stack o en un hueco libre); si no cabe, lo tira. */
	private static void soltarCursor(Minecraft mc, CraftingMenu menu) {
		for (int i = 10; i < menu.slots.size() && !menu.getCarried().isEmpty(); i++) {
			ItemStack s = menu.getSlot(i).getItem();
			boolean cabe = s.isEmpty() || (ItemStack.isSameItemSameComponents(s, menu.getCarried()) && s.getCount() < s.getMaxStackSize());
			if (cabe) click(mc, menu, i, 0);
		}
		if (!menu.getCarried().isEmpty()) click(mc, menu, -999, 0); // clic fuera de la ventana = tirar
	}

	private static void click(Minecraft mc, CraftingMenu menu, int slot, int boton) {
		input(mc, menu, slot, boton, ContainerInput.PICKUP);
	}

	private static void input(Minecraft mc, CraftingMenu menu, int slot, int boton, ContainerInput tipo) {
		mc.gameMode.handleContainerInput(menu.containerId, slot, boton, tipo, mc.player);
	}

	private static void aviso(Minecraft mc, String texto) {
		mc.player.sendOverlayMessage(Component.literal("AutoCraft: " + texto));
	}

	// --- Recetas (salen del libro de recetas, así que solo están las que tienes desbloqueadas) ---

	static String clave(Item item) {
		return BuiltInRegistries.ITEM.getKey(item).toString();
	}

	/** Recetas de mesa de crafteo (con forma o sin forma) que conoce el jugador. */
	private static List<RecipeDisplayEntry> crafteos(Minecraft mc) {
		List<RecipeDisplayEntry> lista = new ArrayList<>();
		for (RecipeCollection col : mc.player.getRecipeBook().getCollections()) {
			for (RecipeDisplayEntry e : col.getRecipes()) {
				if (e.display() instanceof ShapedCraftingRecipeDisplay || e.display() instanceof ShapelessCraftingRecipeDisplay) lista.add(e);
			}
		}
		return lista;
	}

	/** Lo que se puede elegir en el menú: un resultado por objeto. */
	static List<Opcion> opciones(Minecraft mc) {
		ContextMap ctx = SlotDisplayContext.fromLevel(mc.level);
		Map<String, Opcion> m = new LinkedHashMap<>();
		for (RecipeDisplayEntry e : crafteos(mc)) {
			ItemStack r = e.display().result().resolveForFirstStack(ctx);
			if (!r.isEmpty()) m.putIfAbsent(clave(r.getItem()), new Opcion(clave(r.getItem()), r.getHoverName()));
		}
		return new ArrayList<>(m.values());
	}

	void elegir(String clave) {
		objetivo = clave;
		receta = null;
		reintento = 20;
	}

	/** Receta del objetivo, cacheada por mundo; si no está, se reintenta cada segundo (por si la desbloqueas). */
	Receta receta(Minecraft mc) {
		boolean caducada = receta == null ? ++reintento >= 20 : nivelReceta != mc.level || !receta.objetivo().equals(objetivo);
		if (caducada && mc.player != null && mc.level != null) {
			receta = crearReceta(mc);
			nivelReceta = mc.level;
			reintento = 0;
		}
		return receta;
	}

	private Receta crearReceta(Minecraft mc) {
		ContextMap ctx = SlotDisplayContext.fromLevel(mc.level);
		for (RecipeDisplayEntry e : crafteos(mc)) {
			ItemStack res = e.display().result().resolveForFirstStack(ctx);
			if (res.isEmpty() || !clave(res.getItem()).equals(objetivo)) continue;

			List<SlotDisplay> ing;
			int ancho;
			if (e.display() instanceof ShapedCraftingRecipeDisplay d) {
				ing = d.ingredients();
				ancho = d.width();
			} else {
				ing = ((ShapelessCraftingRecipeDisplay) e.display()).ingredients();
				ancho = 3;
			}
			Map<SlotDisplay, List<Integer>> porIngrediente = new LinkedHashMap<>();
			for (int i = 0; i < ing.size(); i++) {
				porIngrediente.computeIfAbsent(ing.get(i), k -> new ArrayList<>()).add(1 + (i / ancho) * 3 + i % ancho);
			}

			// Cupo por defecto: huecos de inventario repartidos según lo rápido que se gasta cada ingrediente
			// (cuántos pide la receta / cuántos caben en un stack).
			List<List<ItemStack>> posibles = new ArrayList<>();
			double total = 0;
			for (var entrada : porIngrediente.entrySet()) {
				List<ItemStack> p = entrada.getKey().resolveForStacks(ctx);
				posibles.add(p);
				if (!p.isEmpty()) total += (double) entrada.getValue().size() / p.get(0).getMaxStackSize();
			}

			List<Grupo> grupos = new ArrayList<>();
			boolean[] usados = new boolean[10];
			int k = 0;
			for (var entrada : porIngrediente.entrySet()) {
				List<ItemStack> p = posibles.get(k++);
				if (p.isEmpty()) continue; // hueco vacío del patrón
				Set<Item> items = new HashSet<>();
				for (ItemStack s : p) items.add(s.getItem());
				double peso = (double) entrada.getValue().size() / p.get(0).getMaxStackSize();
				int cupo = Math.max(1, (int) Math.round(HUECOS_PRINCIPAL * peso / total));
				grupos.add(new Grupo(clave(p.get(0).getItem()), p.get(0).getHoverName(), entrada.getValue(), items, cupo));
				for (int h : entrada.getValue()) usados[h] = true;
			}
			return new Receta(objetivo, res.getHoverName(), grupos, usados);
		}
		return null;
	}

	int cupo(Grupo g) {
		return cupos.getOrDefault(objetivo + "|" + g.clave(), g.cupoPorDefecto());
	}

	void ponerCupo(Grupo g, int valor) {
		cupos.put(objetivo + "|" + g.clave(), Math.clamp(valor, 0, HUECOS_PRINCIPAL));
	}

	// --- Config ---

	private void cargar() {
		// Lo que pediste para el dispensador: 7 stacks de roquedo, 3 de redstone y 17 arcos.
		cupos.put("minecraft:dispenser|minecraft:cobblestone", 7);
		cupos.put("minecraft:dispenser|minecraft:redstone", 3);
		cupos.put("minecraft:dispenser|minecraft:bow", 17);
		if (!Files.exists(CONFIG)) return;
		try (Reader r = Files.newBufferedReader(CONFIG)) {
			Properties p = new Properties();
			p.load(r);
			activo = Boolean.parseBoolean(p.getProperty("activo", "true"));
			objetivo = p.getProperty("objetivo", objetivo);
			intervalo = Math.max(1, Integer.parseInt(p.getProperty("intervalo", "10")));
			reserva = Math.max(0, Integer.parseInt(p.getProperty("reserva", "1")));
			tirar = Boolean.parseBoolean(p.getProperty("tirar", "true"));
			limpiar = Boolean.parseBoolean(p.getProperty("limpiar", "true"));
			for (String k : p.stringPropertyNames()) {
				if (k.startsWith("cupo.")) cupos.put(k.substring(5), Integer.parseInt(p.getProperty(k)));
			}
		} catch (Exception e) {
			System.err.println("[AutoDispensador] Config inválida, uso valores por defecto: " + e);
		}
	}

	void guardar() {
		Properties p = new Properties();
		p.setProperty("activo", String.valueOf(activo));
		p.setProperty("objetivo", objetivo);
		p.setProperty("intervalo", String.valueOf(intervalo));
		p.setProperty("reserva", String.valueOf(reserva));
		p.setProperty("tirar", String.valueOf(tirar));
		p.setProperty("limpiar", String.valueOf(limpiar));
		cupos.forEach((k, v) -> p.setProperty("cupo." + k, String.valueOf(v)));
		try (Writer w = Files.newBufferedWriter(CONFIG)) {
			p.store(w, "AutoDispensador - intervalo en ticks (20 = 1 segundo)");
		} catch (Exception e) {
			System.err.println("[AutoDispensador] No se pudo guardar la config: " + e);
		}
	}
}
