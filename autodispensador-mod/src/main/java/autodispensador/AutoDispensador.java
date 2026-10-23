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

	private boolean activo = false;
	private int intervalo = 10; // ticks entre crafteos (20 ticks = 1 segundo)
	private int espera = 0;

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
								})))));
	}

	/** Un crafteo como mucho por llamada. Sale sin hacer nada si falta algo o si llevas un objeto en el cursor. */
	private static void craftear(Minecraft mc) {
		if (mc.player == null || mc.gameMode == null) return;
		if (!(mc.player.containerMenu instanceof CraftingMenu menu) || !menu.getCarried().isEmpty()) return;

		// Primero recoge el dispensador ya listo y luego rellena para el siguiente
		// (el servidor calcula el resultado, así que tarda un tick en aparecer).
		if (menu.getSlot(RESULTADO).getItem().is(Items.DISPENSER)) click(mc, menu, RESULTADO, ContainerInput.QUICK_MOVE);

		for (int hueco : ROQUEDO) if (!rellenar(mc, menu, hueco, Items.COBBLESTONE)) return;
		if (rellenar(mc, menu, REDSTONE, Items.REDSTONE)) rellenar(mc, menu, ARCO, Items.BOW);
	}

	/** Si el hueco de la rejilla está vacío, le mete un stack del inventario. false si no se puede. */
	private static boolean rellenar(Minecraft mc, CraftingMenu menu, int hueco, Item item) {
		ItemStack actual = menu.getSlot(hueco).getItem();
		if (!actual.isEmpty()) return actual.is(item);
		for (int i = 10; i < menu.slots.size(); i++) {
			ItemStack s = menu.getSlot(i).getItem();
			// Los arcos encantados no se tocan, para no gastar tu arco bueno.
			if (!s.is(item) || (item == Items.BOW && s.isEnchanted())) continue;
			click(mc, menu, i, ContainerInput.PICKUP);
			click(mc, menu, hueco, ContainerInput.PICKUP);
			return true;
		}
		return false;
	}

	private static void click(Minecraft mc, CraftingMenu menu, int slot, ContainerInput tipo) {
		mc.gameMode.handleInventoryMouseClick(menu.containerId, slot, 0, tipo, mc.player);
	}

	private int estado(FabricClientCommandSource source) {
		source.sendFeedback(Component.literal("AutoDispensador: " + (activo ? "ON" : "OFF") + " (tecla K) | 1 dispensador cada "
				+ intervalo + " ticks (" + (intervalo / 20.0) + " s)"));
		return 1;
	}

	private void cargar() {
		if (!Files.exists(CONFIG)) return;
		try (Reader r = Files.newBufferedReader(CONFIG)) {
			Properties p = new Properties();
			p.load(r);
			intervalo = Math.max(1, Integer.parseInt(p.getProperty("intervalo", "10")));
		} catch (Exception e) {
			System.err.println("[AutoDispensador] Config inválida, uso valores por defecto: " + e);
		}
	}

	private void guardar() {
		Properties p = new Properties();
		p.setProperty("intervalo", String.valueOf(intervalo));
		try (Writer w = Files.newBufferedWriter(CONFIG)) {
			p.store(w, "AutoDispensador - intervalo en ticks (20 = 1 segundo)");
		} catch (Exception e) {
			System.err.println("[AutoDispensador] No se pudo guardar la config: " + e);
		}
	}
}
