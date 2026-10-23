package autodispensador;

import com.mojang.blaze3d.platform.InputConstants;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.command.v2.ClientCommands;
import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keymapping.v1.KeyMappingHelper;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.CraftingMenu;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import org.lwjgl.glfw.GLFW;

import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

/**
 * Solo cliente: con una mesa de crafteo abierta, hace los clics por ti.
 * Deja roquedo y redstone en la rejilla y va metiendo un arco cada vez, como harías a mano,
 * así que funciona en servidores sin instalar nada en ellos.
 */
public class AutoDispensador implements ClientModInitializer {
	private static final Path CONFIG = FabricLoader.getInstance().getConfigDir().resolve("autodispensador.properties");

	// Huecos del CraftingMenu: 0 = resultado, 1-9 = rejilla 3x3, 10-45 = inventario.
	private static final int RESULTADO = 0, ARCO = 5, REDSTONE = 8;
	private static final int[] ROQUEDO = {1, 2, 3, 4, 6, 7, 9};
	// Huecos 10-36 = inventario principal, 37-45 = barra rápida (esa no se toca, ahí guardas lo tuyo).
	private static final int FIN_PRINCIPAL = 37, STACKS_ROQUEDO = 7, STACKS_REDSTONE = 3;
	private static final int ARCOS = FIN_PRINCIPAL - 10 - STACKS_ROQUEDO - STACKS_REDSTONE; // 17

	private boolean activo = true; // K lo apaga/enciende (fuera de menús: Minecraft no lee teclas con un menú abierto)
	private int intervalo = 10; // ticks entre crafteos (20 ticks = 1 segundo)
	private int reserva = 1; // cuántos de cada ingrediente se dejan siempre en el inventario
	private int espera = 0;
	private int atascado = 0; // ticks con algo en el cursor

	@Override
	public void onInitializeClient() {
		cargar();
		KeyMapping tecla = KeyMappingHelper.registerKeyMapping(new KeyMapping(
				"key.autodispensador.toggle", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_K, KeyMapping.Category.MISC));

		ClientTickEvents.END_CLIENT_TICK.register(mc -> {
			while (tecla.consumeClick()) {
				activo = !activo;
				if (mc.player != null) mc.player.sendOverlayMessage(Component.literal("AutoDispensador: " + (activo ? "ON" : "OFF")));
			}
			if (!activo || --espera > 0) return;
			espera = intervalo;
			craftear(mc);
		});

		ClientCommandRegistrationCallback.EVENT.register((dispatcher, buildContext) -> dispatcher.register(
				ClientCommands.literal("autodispensador")
						.executes(ctx -> estado(ctx.getSource()))
						.then(ClientCommands.literal("velocidad").then(ClientCommands.argument("ticks", IntegerArgumentType.integer(1, 1200))
								.executes(ctx -> {
									intervalo = IntegerArgumentType.getInteger(ctx, "ticks");
									guardar();
									return estado(ctx.getSource());
								})))
						.then(ClientCommands.literal("reserva").then(ClientCommands.argument("cantidad", IntegerArgumentType.integer(0, 64))
								.executes(ctx -> {
									reserva = IntegerArgumentType.getInteger(ctx, "cantidad");
									guardar();
									return estado(ctx.getSource());
								})))));
	}

	/** Un crafteo como mucho por llamada. */
	private void craftear(Minecraft mc) {
		if (mc.player == null || mc.gameMode == null) return;
		if (!(mc.player.containerMenu instanceof CraftingMenu menu)) return;

		// Algo en el cursor durante 1 s (desincronización con el servidor, p. ej. recogiste un arco
		// justo en el hueco que el mod acababa de vaciar): se devuelve al inventario y se sigue.
		if (!menu.getCarried().isEmpty()) {
			atascado += intervalo;
			if (atascado < 20) return;
			soltarCursor(mc, menu);
			atascado = 0;
		} else atascado = 0;

		// Primero tira el dispensador ya listo y luego rellena para el siguiente
		// (el servidor calcula el resultado, así que tarda un tick en aparecer).
		if (menu.getSlot(RESULTADO).getItem().is(Items.DISPENSER)) input(mc, menu, RESULTADO, 0, ContainerInput.THROW);

		limpiar(mc, menu);
		if (rellenar(mc, menu, ROQUEDO, Items.COBBLESTONE) && rellenar(mc, menu, new int[]{REDSTONE}, Items.REDSTONE)) {
			rellenar(mc, menu, new int[]{ARCO}, Items.BOW);
		}
	}

	/**
	 * Pone 1 objeto en cada hueco vacío de la rejilla, como clic derecho: coge un stack del inventario,
	 * reparte y devuelve el resto a su sitio. Si en la rejilla hay algo que no toca, lo saca. false si falta material.
	 * Nunca baja del mínimo de {@code reserva} en el inventario.
	 */
	private boolean rellenar(Minecraft mc, CraftingMenu menu, int[] huecos, Item item) {
		int faltan = 0;
		for (int h : huecos) {
			if (!menu.getSlot(h).getItem().isEmpty() && !usable(menu.getSlot(h).getItem(), item)) {
				click(mc, menu, h, 0); // algo que no toca en la rejilla: fuera
				soltarCursor(mc, menu);
			}
			if (menu.getSlot(h).getItem().isEmpty()) faltan++;
		}
		if (faltan == 0) return true;

		int disponibles = 0;
		for (int i = 10; i < menu.slots.size(); i++) {
			ItemStack s = menu.getSlot(i).getItem();
			if (usable(s, item)) disponibles += s.getCount();
		}
		if (disponibles - reserva < faltan) return false;

		for (int i = 10; i < menu.slots.size() && hayHueco(menu, huecos); i++) {
			if (!usable(menu.getSlot(i).getItem(), item)) continue;
			click(mc, menu, i, 0); // coger el stack
			for (int h : huecos) {
				if (menu.getCarried().isEmpty()) break;
				if (menu.getSlot(h).getItem().isEmpty()) click(mc, menu, h, 1); // soltar 1
			}
			if (!menu.getCarried().isEmpty()) click(mc, menu, i, 0); // devolver el resto
		}
		return !hayHueco(menu, huecos);
	}

	// Los arcos encantados no se tocan, para no gastar tu arco bueno.
	private static boolean usable(ItemStack s, Item item) {
		return s.is(item) && !(item == Items.BOW && s.isEnchanted());
	}

	private static boolean hayHueco(CraftingMenu menu, int[] huecos) {
		for (int h : huecos) if (menu.getSlot(h).getItem().isEmpty()) return true;
		return false;
	}

	/**
	 * Inventario principal: 7 huecos reservados para roquedo, 3 para redstone y el resto (17) para arcos sin encantar.
	 * Lo que se pase de su cupo y todo lo demás (dispensadores, flechas, huesos...) se tira, para que siempre entre material.
	 */
	private static void limpiar(Minecraft mc, CraftingMenu menu) {
		int roquedo = 0, redstone = 0, arcos = 0;
		for (int i = 10; i < FIN_PRINCIPAL; i++) {
			ItemStack s = menu.getSlot(i).getItem();
			boolean vale = s.isEmpty() || (usable(s, Items.BOW) && ++arcos <= ARCOS)
					|| (s.is(Items.COBBLESTONE) && ++roquedo <= STACKS_ROQUEDO)
					|| (s.is(Items.REDSTONE) && ++redstone <= STACKS_REDSTONE);
			if (!vale) input(mc, menu, i, 1, ContainerInput.THROW); // Ctrl+Q: tira el stack entero
		}
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

	private int estado(FabricClientCommandSource source) {
		source.sendFeedback(Component.literal("AutoDispensador: " + (activo ? "ON" : "OFF") + " (tecla K) | 1 dispensador cada "
				+ intervalo + " ticks (" + (intervalo / 20.0) + " s) | reserva: " + reserva + " de cada"));
		return 1;
	}

	private void cargar() {
		if (!Files.exists(CONFIG)) return;
		try (Reader r = Files.newBufferedReader(CONFIG)) {
			Properties p = new Properties();
			p.load(r);
			intervalo = Math.max(1, Integer.parseInt(p.getProperty("intervalo", "10")));
			reserva = Math.max(0, Integer.parseInt(p.getProperty("reserva", "1")));
		} catch (Exception e) {
			System.err.println("[AutoDispensador] Config inválida, uso valores por defecto: " + e);
		}
	}

	private void guardar() {
		Properties p = new Properties();
		p.setProperty("intervalo", String.valueOf(intervalo));
		p.setProperty("reserva", String.valueOf(reserva));
		try (Writer w = Files.newBufferedWriter(CONFIG)) {
			p.store(w, "AutoDispensador - intervalo en ticks (20 = 1 segundo)");
		} catch (Exception e) {
			System.err.println("[AutoDispensador] No se pudo guardar la config: " + e);
		}
	}
}
