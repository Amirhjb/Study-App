package autocraft;

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
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.CraftingMenu;
import net.minecraft.world.inventory.InventoryMenu;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
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
public class AutoCraft implements ClientModInitializer {
	private static final Path CONFIG = FabricLoader.getInstance().getConfigDir().resolve("autocraft.properties");

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
	boolean tirar = true; // tirar el resultado (si no, o si se vende, se guarda; si no cabe, se tira igual)
	boolean limpiar = true; // tirar del inventario principal lo que no sea ingrediente o pase de su cupo
	private final Map<String, Integer> cupos = new HashMap<>(); // "objetivo|ingrediente" -> huecos

	boolean vender = false;
	String objetoVenta = ""; // vacío = vender lo que se craftea
	String comando = "ah sell 100"; // sin la barra; vende lo que tengas en la mano
	int cantidadVenta = 1; // cuántos se ponen en la mano para cada venta
	int segundosVenta = 1; // mínimo 1: más rápido, el servidor te echa por spam de comandos
	int huecoVenta = 8; // hueco de la barra rápida (0-8) donde se pone lo que se vende
	private int esperaVenta = 0;

	private int espera = 0; // ticks desde el último crafteo
	private int atascado = 0; // ticks con algo en el cursor
	private Receta receta;
	private Object nivelReceta;
	private int reintento = 20;

	@Override
	public void onInitializeClient() {
		cargar();
		KeyMapping tecla = KeyMappingHelper.registerKeyMapping(new KeyMapping(
				"key.autocraft.menu", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_K, KeyMapping.Category.MISC));

		ClientTickEvents.END_CLIENT_TICK.register(mc -> {
			while (tecla.consumeClick()) {
				if (mc.player != null) mc.setScreen(new Menu(this, opciones(mc)));
			}
			if (activo) craftear(mc);
			if (vender) vender(mc);
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
			input(mc, menu, RESULTADO, 0, !seQueda() || !cabe(menu, resultado) ? ContainerInput.THROW : ContainerInput.QUICK_MOVE);
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
	 * Cada {@code segundosVenta}: deja exactamente {@code cantidadVenta} del objetivo en el hueco de venta,
	 * lo pone en la mano y manda el comando. Cada paso espera al tick siguiente para que el servidor ya
	 * tenga el hueco correcto cuando le llega el comando (si no, vendería otra cosa).
	 */
	private void vender(Minecraft mc) {
		if (mc.player == null || mc.gameMode == null || mc.getConnection() == null) return;
		if (++esperaVenta < segundosVenta * 20) return;
		// Solo con la mesa o el inventario (o nada) abierto: nunca hace clics en menús del servidor, como el del /ah.
		AbstractContainerMenu menu = mc.player.containerMenu;
		if (!(menu instanceof CraftingMenu || menu instanceof InventoryMenu)) {
			aviso(mc, "venta en pausa: hay abierto un menú que no es la mesa ni el inventario (" + menu.getClass().getSimpleName() + ")");
			return;
		}
		if (!menu.getCarried().isEmpty()) {
			aviso(mc, "venta en pausa: hay algo en el cursor");
			return;
		}
		Inventory inv = mc.player.getInventory();
		int mano = hueco(menu, inv, huecoVenta);
		if (mano < 0) return;

		ItemStack s = menu.getSlot(mano).getItem();
		if (!s.isEmpty() && !clave(s.getItem()).equals(aVender())) {
			aviso(mc, "deja libre el hueco " + (huecoVenta + 1) + " de la barra para vender");
			return;
		}
		if (s.getCount() != cantidadVenta) {
			if (!s.isEmpty()) {
				click(mc, menu, mano, 0); // vaciar el hueco y colocar la cantidad justa
				soltarCursor(mc, menu, mano);
			}
			aviso(mc, llenar(mc, menu, mano, cantidadVenta) ? "venta: poniendo " + cantidadVenta + " en el hueco " + (huecoVenta + 1)
					: "venta: esperando " + cantidadVenta + " para vender");
			return;
		}
		if (inv.getSelectedSlot() != huecoVenta) {
			inv.setSelectedSlot(huecoVenta);
			aviso(mc, "venta: cambiando la mano al hueco " + (huecoVenta + 1));
			return;
		}
		mc.getConnection().sendCommand(comando);
		esperaVenta = 0;
		aviso(mc, "venta: enviado /" + comando);
		System.out.println("[AutoCraft] enviado /" + comando + " con " + s.getCount() + " " + clave(s.getItem()) + " en la mano");
	}

	/** Pone {@code n} de lo que se vende en el hueco vacío {@code destino}, sacándolos de otros huecos. false si no hay bastantes. */
	private boolean llenar(Minecraft mc, AbstractContainerMenu menu, int destino, int n) {
		int hay = 0;
		for (int i = 0; i < menu.slots.size(); i++) {
			ItemStack s = menu.getSlot(i).getItem();
			if (i != destino && esInventario(menu.getSlot(i)) && clave(s.getItem()).equals(aVender())) hay += s.getCount();
		}
		if (hay < n) return false;
		for (int i = 0; i < menu.slots.size() && menu.getSlot(destino).getItem().getCount() < n; i++) {
			ItemStack s = menu.getSlot(i).getItem();
			if (i == destino || !esInventario(menu.getSlot(i)) || s.isEmpty() || !clave(s.getItem()).equals(aVender())) continue;
			click(mc, menu, i, 0);
			int falta = n - menu.getSlot(destino).getItem().getCount();
			if (menu.getCarried().getCount() <= falta) click(mc, menu, destino, 0); // cabe todo
			else for (int k = 0; k < falta; k++) click(mc, menu, destino, 1); // de 1 en 1
			if (!menu.getCarried().isEmpty()) click(mc, menu, i, 0); // devolver el resto
		}
		return true;
	}

	/** Inventario principal o barra rápida (no armadura ni mano izquierda). */
	private static boolean esInventario(Slot sl) {
		return sl.container instanceof Inventory && sl.getContainerSlot() < 36;
	}

	/** Lo que se vende: el objeto elegido en la pestaña Venta o, si no hay, lo que se craftea. */
	String aVender() {
		return objetoVenta.isEmpty() ? objetivo : objetoVenta;
	}

	/** Si el resultado se guarda en el inventario (para venderlo hace falta guardarlo). */
	boolean seQueda() {
		return !tirar || (vender && aVender().equals(objetivo));
	}

	/** Índice en el menú del hueco {@code indice} del inventario del jugador (0-8 = barra rápida). */
	private static int hueco(AbstractContainerMenu menu, Inventory inv, int indice) {
		for (int i = 0; i < menu.slots.size(); i++) {
			Slot sl = menu.slots.get(i);
			if (sl.container == inv && sl.getContainerSlot() == indice) return i;
		}
		return -1;
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
			String k = clave(s.getItem());
			if (s.isEmpty() || (seQueda() && k.equals(r.objetivo())) || (vender && k.equals(aVender()))) continue; // lo que se vende no se tira
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
	private static void soltarCursor(Minecraft mc, AbstractContainerMenu menu) {
		soltarCursor(mc, menu, -1);
	}

	private static void soltarCursor(Minecraft mc, AbstractContainerMenu menu, int evitar) {
		for (int i = 0; i < menu.slots.size() && !menu.getCarried().isEmpty(); i++) {
			if (i == evitar || !esInventario(menu.getSlot(i))) continue;
			ItemStack s = menu.getSlot(i).getItem();
			boolean cabe = s.isEmpty() || (ItemStack.isSameItemSameComponents(s, menu.getCarried()) && s.getCount() < s.getMaxStackSize());
			if (cabe) click(mc, menu, i, 0);
		}
		if (!menu.getCarried().isEmpty()) click(mc, menu, -999, 0); // clic fuera de la ventana = tirar
	}

	private static void click(Minecraft mc, AbstractContainerMenu menu, int slot, int boton) {
		input(mc, menu, slot, boton, ContainerInput.PICKUP);
	}

	private static void input(Minecraft mc, AbstractContainerMenu menu, int slot, int boton, ContainerInput tipo) {
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

	/** Todos los objetos del juego, para elegir qué vender. */
	static List<Opcion> todosLosObjetos() {
		return BuiltInRegistries.ITEM.stream().filter(i -> i != Items.AIR)
				.map(i -> new Opcion(clave(i), new ItemStack(i).getHoverName())).toList();
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
		// Si aún no hay config de AutoCraft, se leen los ajustes de cuando el mod se llamaba AutoDispensador.
		Path origen = Files.exists(CONFIG) ? CONFIG : CONFIG.resolveSibling("autodispensador.properties");
		if (!Files.exists(origen)) return;
		try (Reader r = Files.newBufferedReader(origen)) {
			Properties p = new Properties();
			p.load(r);
			activo = Boolean.parseBoolean(p.getProperty("activo", "true"));
			objetivo = p.getProperty("objetivo", objetivo);
			intervalo = Math.max(1, Integer.parseInt(p.getProperty("intervalo", "10")));
			reserva = Math.max(0, Integer.parseInt(p.getProperty("reserva", "1")));
			tirar = Boolean.parseBoolean(p.getProperty("tirar", "true"));
			limpiar = Boolean.parseBoolean(p.getProperty("limpiar", "true"));
			vender = Boolean.parseBoolean(p.getProperty("vender", "false"));
			comando = p.getProperty("comando", comando);
			objetoVenta = p.getProperty("objetoVenta", "");
			cantidadVenta = Math.clamp(Integer.parseInt(p.getProperty("cantidadVenta", "1")), 1, 64);
			segundosVenta = Math.max(1, Integer.parseInt(p.getProperty("segundosVenta", "1")));
			huecoVenta = Math.clamp(Integer.parseInt(p.getProperty("huecoVenta", "8")), 0, 8);
			for (String k : p.stringPropertyNames()) {
				if (k.startsWith("cupo.")) cupos.put(k.substring(5), Integer.parseInt(p.getProperty(k)));
			}
		} catch (Exception e) {
			System.err.println("[AutoCraft] Config inválida, uso valores por defecto: " + e);
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
		p.setProperty("vender", String.valueOf(vender));
		p.setProperty("comando", comando);
		p.setProperty("objetoVenta", objetoVenta);
		p.setProperty("cantidadVenta", String.valueOf(cantidadVenta));
		p.setProperty("segundosVenta", String.valueOf(segundosVenta));
		p.setProperty("huecoVenta", String.valueOf(huecoVenta));
		cupos.forEach((k, v) -> p.setProperty("cupo." + k, String.valueOf(v)));
		try (Writer w = Files.newBufferedWriter(CONFIG)) {
			p.store(w, "AutoCraft - intervalo en ticks (20 = 1 segundo)");
		} catch (Exception e) {
			System.err.println("[AutoCraft] No se pudo guardar la config: " + e);
		}
	}
}
