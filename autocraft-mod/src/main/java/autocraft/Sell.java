package autocraft;

import net.minecraft.client.Minecraft;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.ContainerInput;
import net.minecraft.world.inventory.CraftingMenu;
import net.minecraft.world.inventory.InventoryMenu;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;

import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Properties;
import java.util.Set;

/**
 * Pestaña Sell, en bucle: manda /sell, mete en el menú que abre el servidor lo que toca vender (Mayús+clic)
 * y pulsa el botón verde de abajo a la derecha. Si el menú sigue abierto, la siguiente vuelta lo reutiliza.
 */
class Sell {
	boolean activo = false;
	String comando = "sell";
	boolean todo = false; // true: todo el inventario; false: solo los elegidos
	boolean barra = false; // si también se vende lo que hay en la barra rápida
	boolean tirarResto = false; // con el menú de venta abierto, tirar lo que no esté en la lista
	final Set<String> elegidos = new LinkedHashSet<>();
	int segundos = 1; // entre ventas (mínimo 1: más rápido, el servidor te echa por spam de comandos)
	int ticksEntreClics = 1; // 0 = todos los clics de golpe

	private enum Paso { ESPERA, ABRIENDO, METIENDO }

	private Paso paso = Paso.ESPERA;
	private int ticks = 0;
	private int menuVenta = -1; // containerId del menú que abrió /sell
	private final Set<Integer> probados = new HashSet<>(); // huecos ya metidos en esta vuelta
	private int movidos = 0; // objetos metidos en esta vuelta
	private boolean ultimaVacia = false; // la vuelta anterior no pudo meter nada

	void tick(Minecraft mc) {
		if (mc.player == null || mc.gameMode == null || mc.getConnection() == null) return;
		AbstractContainerMenu menu = mc.player.containerMenu;
		boolean delJugador = menu instanceof InventoryMenu || menu instanceof CraftingMenu;
		boolean abierto = !delJugador && menu.containerId == menuVenta;
		ticks++;
		if (abierto && tirarResto && !todo && menu.getCarried().isEmpty()) tirarLoDemas(mc, menu);

		switch (paso) {
			case ESPERA -> {
				if (!hayQueVender(mc.player.getInventory())) {
					AutoCraft.aviso(mc, "sell: nada que vender");
					return;
				}
				if (abierto) {
					// Con el menú aún abierto no hay que mandar /sell: se vuelve a meter en cuanto hay algo (2 ticks de
					// margen). Solo si la vuelta anterior no pudo meter nada se espera "Cada N s", para no pulsar en bucle.
					if (ticks < (ultimaVacia ? segundos * 20 : 2)) return;
					empezarAMeter();
				} else if (delJugador) {
					if (ticks < segundos * 20) return; // el comando sí espera: más de 1 por segundo y te echan por spam
					mc.getConnection().sendCommand(comando);
					paso = Paso.ABRIENDO;
					ticks = 0;
				} else {
					AutoCraft.aviso(mc, "sell en pausa: cierra el menú que tienes abierto");
				}
			}
			case ABRIENDO -> {
				if (!delJugador) {
					menuVenta = menu.containerId;
					empezarAMeter();
				} else if (ticks > 100) {
					AutoCraft.aviso(mc, "sell: /" + comando + " no ha abierto ningún menú");
					paso = Paso.ESPERA;
					ticks = 0;
				}
			}
			case METIENDO -> {
				if (!abierto) { // lo ha cerrado el servidor o tú
					paso = Paso.ESPERA;
					return;
				}
				int boton = botonVerde(menu);
				if (boton < 0) { // el contenido del menú aún no ha llegado, o no hay botón verde
					if (ticks > 100) {
						ItemStack x = ultimoHueco(menu) < 0 ? ItemStack.EMPTY : menu.getSlot(ultimoHueco(menu)).getItem();
						AutoCraft.aviso(mc, "sell: no encuentro el botón verde abajo a la derecha (hay: " + x.getHoverName().getString() + ")");
						paso = Paso.ESPERA;
						ticks = 0;
					}
					return;
				}
				if (!menu.getCarried().isEmpty() || ticks < ticksEntreClics) return;

				for (int i = 0; i < menu.slots.size(); i++) {
					Slot sl = menu.slots.get(i);
					if (probados.contains(i) || !(sl.container instanceof Inventory) || sl.getContainerSlot() >= 36) continue;
					if (!seVende(sl.getContainerSlot(), sl.getItem())) continue;
					probados.add(i); // una vez por vuelta: si el menú no lo acepta, no se reintenta en bucle
					AutoCraft.input(mc, menu, i, 0, ContainerInput.QUICK_MOVE);
					movidos++;
					ticks = 0;
					if (ticksEntreClics > 0) return; // un clic cada ticksEntreClics
				}
				ultimaVacia = movidos == 0;
				if (!ultimaVacia) {
					AutoCraft.click(mc, menu, boton, 0);
					AutoCraft.aviso(mc, "sell: vendido");
				}
				paso = Paso.ESPERA;
				ticks = 0;
			}
		}
	}

	/** Tira (Ctrl+Q) lo de tu inventario que no esté en la lista; la barra rápida solo con "Incluir barra rápida". */
	private void tirarLoDemas(Minecraft mc, AbstractContainerMenu menu) {
		for (int i = 0; i < menu.slots.size(); i++) {
			Slot sl = menu.slots.get(i);
			if (!(sl.container instanceof Inventory) || sl.getContainerSlot() >= 36 || (sl.getContainerSlot() < 9 && !barra)) continue;
			if (sl.hasItem() && !elegidos.contains(AutoCraft.clave(sl.getItem().getItem()))) {
				AutoCraft.input(mc, menu, i, 1, ContainerInput.THROW);
			}
		}
	}

	private void empezarAMeter() {
		paso = Paso.METIENDO;
		probados.clear();
		movidos = 0;
		ticks = 0;
	}

	/** Inventario principal (9-35) y, si se elige, la barra rápida (0-8). En "solo los elegidos", encantados no. */
	private boolean seVende(int indice, ItemStack s) {
		if (s.isEmpty() || (indice < 9 && !barra)) return false;
		if (todo) return true;
		return elegidos.contains(AutoCraft.clave(s.getItem())) && !s.isEnchanted();
	}

	private boolean hayQueVender(Inventory inv) {
		for (int i = 0; i < 36; i++) if (seVende(i, inv.getItem(i))) return true;
		return false;
	}

	/** Último hueco del menú del servidor (sin contar tu inventario): abajo a la derecha. */
	private static int ultimoHueco(AbstractContainerMenu menu) {
		int ultimo = -1;
		for (int i = 0; i < menu.slots.size(); i++) if (!(menu.slots.get(i).container instanceof Inventory)) ultimo = i;
		return ultimo;
	}

	/** El hueco de abajo a la derecha si tiene algo verde (cristal, lana, hormigón... lima o verde, o esmeralda). */
	private static int botonVerde(AbstractContainerMenu menu) {
		int i = ultimoHueco(menu);
		if (i < 0) return -1;
		String k = AutoCraft.clave(menu.getSlot(i).getItem().getItem());
		return k.contains("lime") || k.contains("green") || k.contains("emerald") ? i : -1;
	}

	void cargar(Properties p) {
		activo = Boolean.parseBoolean(p.getProperty("sell.activo", "false"));
		comando = p.getProperty("sell.comando", comando);
		todo = Boolean.parseBoolean(p.getProperty("sell.todo", "false"));
		barra = Boolean.parseBoolean(p.getProperty("sell.barra", "false"));
		tirarResto = Boolean.parseBoolean(p.getProperty("sell.tirarResto", "false"));
		segundos = Math.max(1, Integer.parseInt(p.getProperty("sell.segundos", "1")));
		ticksEntreClics = Math.clamp(Integer.parseInt(p.getProperty("sell.ticksEntreClics", "1")), 0, 20);
		elegidos.clear();
		for (String k : p.getProperty("sell.elegidos", "").split(",")) if (!k.isBlank()) elegidos.add(k.trim());
	}

	void guardar(Properties p) {
		p.setProperty("sell.activo", String.valueOf(activo));
		p.setProperty("sell.comando", comando);
		p.setProperty("sell.todo", String.valueOf(todo));
		p.setProperty("sell.barra", String.valueOf(barra));
		p.setProperty("sell.tirarResto", String.valueOf(tirarResto));
		p.setProperty("sell.segundos", String.valueOf(segundos));
		p.setProperty("sell.ticksEntreClics", String.valueOf(ticksEntreClics));
		p.setProperty("sell.elegidos", String.join(",", elegidos));
	}
}
