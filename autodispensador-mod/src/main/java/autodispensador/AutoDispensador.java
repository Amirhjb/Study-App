package autodispensador;

import com.mojang.brigadier.arguments.IntegerArgumentType;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Properties;

public class AutoDispensador implements ModInitializer {
	private static final Path CONFIG = FabricLoader.getInstance().getConfigDir().resolve("autodispensador.properties");

	private boolean activado = true;
	private int intervalo = 10; // ticks entre crafteos (20 ticks = 1 segundo)

	@Override
	public void onInitialize() {
		cargar();

		ServerTickEvents.END_SERVER_TICK.register(server -> {
			if (!activado || server.getTickCount() % intervalo != 0) return;
			for (ServerPlayer player : server.getPlayerList().getPlayers()) {
				craftear(player.getInventory());
			}
		});

		CommandRegistrationCallback.EVENT.register((dispatcher, buildContext, selection) -> dispatcher.register(
				Commands.literal("autodispensador")
						.executes(ctx -> estado(ctx.getSource()))
						.then(Commands.literal("on").executes(ctx -> { activado = true; guardar(); return estado(ctx.getSource()); }))
						.then(Commands.literal("off").executes(ctx -> { activado = false; guardar(); return estado(ctx.getSource()); }))
						.then(Commands.literal("velocidad").then(Commands.argument("ticks", IntegerArgumentType.integer(1, 1200))
								.executes(ctx -> {
									intervalo = IntegerArgumentType.getInteger(ctx, "ticks");
									guardar();
									return estado(ctx.getSource());
								})))));
	}

	/** Receta del dispensador: 7 roquedo + 1 arco + 1 redstone. Hace como mucho un crafteo por llamada. */
	private static void craftear(Inventory inv) {
		int arco = -1;
		for (int i = 0; i < inv.getContainerSize(); i++) {
			ItemStack s = inv.getItem(i);
			// Los arcos encantados no se tocan, para no gastar tu arco bueno.
			if (s.is(Items.BOW) && !s.isEnchanted()) { arco = i; break; }
		}
		if (arco < 0 || contar(inv, Items.COBBLESTONE) < 7 || contar(inv, Items.REDSTONE) < 1) return;

		inv.getItem(arco).shrink(1);
		quitar(inv, Items.COBBLESTONE, 7);
		quitar(inv, Items.REDSTONE, 1);
		inv.placeItemBackInInventory(new ItemStack(Items.DISPENSER));
	}

	private static int contar(Inventory inv, Item item) {
		int n = 0;
		for (int i = 0; i < inv.getContainerSize(); i++) {
			ItemStack s = inv.getItem(i);
			if (s.is(item)) n += s.getCount();
		}
		return n;
	}

	private static void quitar(Inventory inv, Item item, int cantidad) {
		for (int i = 0; i < inv.getContainerSize() && cantidad > 0; i++) {
			ItemStack s = inv.getItem(i);
			if (!s.is(item)) continue;
			int n = Math.min(cantidad, s.getCount());
			s.shrink(n);
			cantidad -= n;
		}
	}

	private int estado(CommandSourceStack source) {
		String msg = "AutoDispensador: " + (activado ? "ON" : "OFF") + " | 1 dispensador cada " + intervalo
				+ " ticks (" + (intervalo / 20.0) + " s)";
		source.sendSuccess(() -> Component.literal(msg), false);
		return 1;
	}

	private void cargar() {
		if (!Files.exists(CONFIG)) return;
		try (Reader r = Files.newBufferedReader(CONFIG)) {
			Properties p = new Properties();
			p.load(r);
			activado = Boolean.parseBoolean(p.getProperty("activado", "true"));
			intervalo = Math.max(1, Integer.parseInt(p.getProperty("intervalo", "10")));
		} catch (Exception e) {
			System.err.println("[AutoDispensador] Config inválida, uso valores por defecto: " + e);
		}
	}

	private void guardar() {
		Properties p = new Properties();
		p.setProperty("activado", String.valueOf(activado));
		p.setProperty("intervalo", String.valueOf(intervalo));
		try (Writer w = Files.newBufferedWriter(CONFIG)) {
			p.store(w, "AutoDispensador - intervalo en ticks (20 = 1 segundo)");
		} catch (Exception e) {
			System.err.println("[AutoDispensador] No se pudo guardar la config: " + e);
		}
	}
}
