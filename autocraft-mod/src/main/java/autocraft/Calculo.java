package autocraft;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.CraftingMenu;
import net.minecraft.world.inventory.InventoryMenu;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.ItemLore;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Properties;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pestaña Cálculo. Lee sola dos precios del texto que el servidor pone en los objetos (lo que ves al pasar el
 * cursor): el del polvo de hueso de tu inventario y el de las élitras sin encantar en el menú de /order (se usa
 * la más cara como base). El resto lo pones tú, y calcula ganancias en dinero del juego y en dinero real.
 */
class Calculo {
	// Lo que pones tú
	double precioHueso = 150, polvoPorHueso = 3, segundosPorMillon = 240, precioRealElitra = 0, horasDia = 8;
	int modoPrecio = 0; // el precio leído del polvo es: 0 por unidad, 1 por stack de 64, 2 por el montón del hueco
	static final String[] MODOS = {"por unidad", "por stack de 64", "por el montón"};

	// Lo que lee el mod
	double polvoLeido = -1; // tal cual sale en el texto
	int polvoCantidad = 1; // cuántos había en el hueco donde se leyó
	String polvoTexto = "";
	long polvoCuando = 0;
	double elitraMax = -1, elitraMin = -1;
	int elitrasVistas = 0;
	String elitraTexto = "";
	long elitraCuando = 0;
	double huesoMin = -1;
	int huesosVistos = 0;
	String huesoTexto = "";
	long huesoCuando = 0;

	private int ticks = 0;

	/** Cada medio segundo con un menú abierto, busca los precios en los objetos que se ven. */
	void tick(Minecraft mc) {
		automatico(mc);
		if (++ticks < 10 || mc.player == null || !(mc.screen instanceof AbstractContainerScreen<?> pantalla)) return;
		ticks = 0;
		escanear(mc, pantalla.getTitle().getString().toLowerCase(Locale.ROOT).contains("order"));
	}

	/**
	 * Mira los objetos del menú abierto: el polvo de hueso de tu inventario y, si es un menú de /order, las élitras
	 * sin encantar y los huesos (de cada uno se guarda el más caro, que es la base, y el más barato). true si ha
	 * leído algún precio de /order.
	 */
	private boolean escanear(Minecraft mc, boolean esOrder) {
		double[] elitra = {-1, -1, 0}, hueso = {-1, -1, 0}; // máx, mín, vistos
		String[] textos = {"", ""};
		for (Slot sl : mc.player.containerMenu.slots) {
			ItemStack s = sl.getItem();
			if (s.isEmpty()) continue;
			String clave = AutoCraft.clave(s.getItem());
			boolean tuyo = sl.container instanceof Inventory;
			String linea = (tuyo && clave.equals("minecraft:bone_meal")) || (!tuyo && esOrder) ? lineaDePrecio(s) : null;
			double v = linea == null ? -1 : numero(linea);
			if (v <= 0) continue;
			if (tuyo && clave.equals("minecraft:bone_meal")) {
				polvoLeido = v;
				polvoCantidad = s.getCount();
				polvoTexto = linea;
				polvoCuando = System.currentTimeMillis();
			} else if (!tuyo && clave.equals("minecraft:elytra") && !s.isEnchanted()) {
				anotar(elitra, textos, 0, v, linea);
			} else if (!tuyo && clave.equals("minecraft:bone")) {
				anotar(hueso, textos, 1, v, linea);
			}
		}
		long ahora = System.currentTimeMillis();
		if (elitra[2] > 0) {
			elitraMax = elitra[0];
			elitraMin = elitra[1];
			elitrasVistas = (int) elitra[2];
			elitraTexto = textos[0];
			elitraCuando = ahora;
		}
		if (hueso[2] > 0) {
			precioHueso = hueso[0]; // el más caro: el que tienes que igualar para que te vendan a ti
			huesoMin = hueso[1];
			huesosVistos = (int) hueso[2];
			huesoTexto = textos[1];
			huesoCuando = ahora;
		}
		return elitra[2] > 0 || hueso[2] > 0;
	}

	private static void anotar(double[] m, String[] textos, int i, double v, String linea) {
		if (v > m[0]) {
			m[0] = v;
			textos[i] = linea;
		}
		if (m[1] < 0 || v < m[1]) m[1] = v;
		m[2]++;
	}

	// --- Botón "Actualizar precios": /order elytra y /order bone, uno detrás de otro ---

	private enum Fase { NADA, ESPERAR, LEER }

	private Fase fase = Fase.NADA;
	private int faseTicks = 0;
	private final List<String> cola = new ArrayList<>();
	private Runnable alTerminar;

	boolean actualizando() {
		return fase != Fase.NADA;
	}

	void actualizarPrecios(Runnable alTerminar) {
		cola.clear();
		cola.add("order elytra");
		cola.add("order bone");
		this.alTerminar = alTerminar;
		fase = Fase.ESPERAR;
		faseTicks = 20;
	}

	private void automatico(Minecraft mc) {
		if (fase == Fase.NADA || mc.player == null || mc.getConnection() == null) return;
		faseTicks++;
		if (fase == Fase.ESPERAR) {
			if (faseTicks < 25) return; // más de 1 comando por segundo y el servidor te echa por spam
			if (cola.isEmpty()) {
				fase = Fase.NADA;
				AutoCraft.aviso(mc, "precios actualizados");
				if (alTerminar != null) alTerminar.run();
				return;
			}
			String comando = cola.removeFirst();
			mc.getConnection().sendCommand(comando);
			AutoCraft.aviso(mc, "precios: /" + comando);
			fase = Fase.LEER;
			faseTicks = 0;
			return;
		}
		// LEER: espera al menú de /order, lee los precios (o se rinde a los 3 s) y lo cierra
		boolean abierto = mc.screen instanceof AbstractContainerScreen<?>
				&& !(mc.player.containerMenu instanceof InventoryMenu || mc.player.containerMenu instanceof CraftingMenu);
		if (abierto && (escanear(mc, true) || faseTicks > 60)) {
			mc.player.closeContainer();
			fase = Fase.ESPERAR;
			faseTicks = 0;
		} else if (!abierto && faseTicks > 100) {
			AutoCraft.aviso(mc, "precios: el servidor no ha abierto ningún menú");
			fase = Fase.ESPERAR;
			faseTicks = 0;
		}
	}


	// --- Leer precios del texto de los objetos ---

	private static final Pattern PALABRAS = Pattern.compile("(?i)\\$|precio|price|sell|venta|vend|worth|valor|value|cost|pay|pag");
	private static final Pattern NUMERO = Pattern.compile("(\\d[\\d.,]*)\\s*([kKmMbB])?(?![a-zA-Z])");

	/** La primera línea del texto del objeto (nombre o descripción) que parece un precio. */
	static String lineaDePrecio(ItemStack s) {
		List<Component> lineas = new ArrayList<>();
		lineas.add(s.getHoverName());
		ItemLore lore = s.get(DataComponents.LORE);
		if (lore != null) lineas.addAll(lore.lines());
		for (Component c : lineas) {
			String t = c.getString();
			if (PALABRAS.matcher(t).find() && NUMERO.matcher(t).find()) return t.strip();
		}
		return null;
	}

	/**
	 * El primer número de la línea, entendiendo "7.2K", "1,5M", "7,000", "7.000" o "109.38". Con dos
	 * separadores, el último es el decimal; con uno, es de miles si va seguido de 3 cifras (y sin K/M/B).
	 */
	static double numero(String linea) {
		Matcher m = NUMERO.matcher(linea);
		if (!m.find()) return -1;
		String n = m.group(1).replaceAll("[.,]+$", "");
		String sufijo = m.group(2);
		int coma = n.lastIndexOf(','), punto = n.lastIndexOf('.');
		if (coma >= 0 && punto >= 0) {
			char decimal = coma > punto ? ',' : '.';
			n = n.replace(decimal == ',' ? "." : ",", "").replace(decimal, '.');
		} else if (coma >= 0 || punto >= 0) {
			char sep = coma >= 0 ? ',' : '.';
			boolean miles = n.indexOf(sep) != n.lastIndexOf(sep) || (n.length() - n.lastIndexOf(sep) - 1 == 3 && sufijo == null);
			n = miles ? n.replace(String.valueOf(sep), "") : n.replace(sep, '.');
		}
		double v;
		try {
			v = Double.parseDouble(n);
		} catch (NumberFormatException e) {
			return -1;
		}
		if (sufijo != null) {
			switch (Character.toLowerCase(sufijo.charAt(0))) {
				case 'k' -> v *= 1e3;
				case 'm' -> v *= 1e6;
				case 'b' -> v *= 1e9;
			}
		}
		return v;
	}

	// --- Cálculos ---

	double polvoPorUnidad() {
		if (polvoLeido <= 0) return -1;
		return switch (modoPrecio) {
			case 1 -> polvoLeido / 64;
			case 2 -> polvoLeido / Math.max(1, polvoCantidad);
			default -> polvoLeido;
		};
	}

	/** Las líneas de resultados de la pestaña (cortas, para que quepan en el menú). */
	List<String> resultados() {
		List<String> r = new ArrayList<>();
		double unidad = polvoPorUnidad();
		if (unidad > 0) {
			r.add("Polvo: " + dinero(unidad) + " c/u");
			r.add("  stack: " + dinero(unidad * 64) + " · " + hace(polvoCuando));
			r.add("  «" + recortar(polvoTexto) + "»");
		} else {
			r.add("Polvo: sin leer");
			r.add("  abre un menú con polvo en tu inventario");
		}
		if (elitraMax > 0) {
			r.add("Élitra /order: " + dinero(elitraMax));
			r.add("  mín " + dinero(elitraMin) + " · " + elitrasVistas + " vistas · " + hace(elitraCuando));
			r.add("  «" + recortar(elitraTexto) + "»");
		} else {
			r.add("Élitra /order: sin leer");
			r.add("  abre /order con élitras sin encantar");
		}
		if (huesoCuando > 0) {
			r.add("Hueso /order: " + dinero(precioHueso));
			r.add("  mín " + dinero(huesoMin) + " · " + huesosVistos + " vistos · " + hace(huesoCuando));
		}
		if (unidad <= 0 || precioHueso <= 0) return r;

		double ingresoHueso = polvoPorHueso * unidad;
		double margen = ingresoHueso - precioHueso;
		r.add("Por hueso: " + dinero(margen) + " (" + numero2(margen / precioHueso * 100) + " %)");
		if (margen <= 0) {
			r.add("¡Con este precio pierdes dinero!");
			return r;
		}
		if (segundosPorMillon <= 0) return r;
		double bruto = 1e6 * 3600 / segundosPorMillon;
		double neto = bruto * (1 - precioHueso / ingresoHueso);
		r.add("Bruto/h: " + dinero(bruto));
		r.add("Neto/h: " + dinero(neto) + " · día " + dinero(neto * horasDia));
		if (elitraMax <= 0) return r;
		double elitrasHora = neto / elitraMax;
		r.add("Élitras: " + numero2(elitrasHora) + "/h · " + numero2(elitrasHora * horasDia) + "/día");
		if (precioRealElitra <= 0) return r;
		r.add("1M del juego = " + numero2(precioRealElitra / elitraMax * 1e6) + " €");
		r.add("Real: " + numero2(elitrasHora * precioRealElitra) + " €/h · " + numero2(elitrasHora * precioRealElitra * horasDia) + " €/día");
		return r;
	}

	static String dinero(double v) {
		if (Math.abs(v) >= 1e6) return numero2(v / 1e6) + "M $";
		if (Math.abs(v) >= 1e4) return numero2(v / 1e3) + "K $";
		return numero2(v) + " $";
	}

	static String numero2(double v) {
		return String.format(Locale.forLanguageTag("es-ES"), "%,.2f", v);
	}

	private static String hace(long cuando) {
		long s = (System.currentTimeMillis() - cuando) / 1000;
		return s < 60 ? "hace " + s + " s" : "hace " + s / 60 + " min";
	}

	private static String recortar(String t) {
		return t.length() > 28 ? t.substring(0, 27) + "…" : t;
	}

	static double leer(String texto, double siFalla) {
		try {
			return Double.parseDouble(texto.trim().replace(',', '.'));
		} catch (NumberFormatException e) {
			return siFalla;
		}
	}

	void cargar(Properties p) {
		precioHueso = leer(p.getProperty("calc.precioHueso", "150"), 150);
		polvoPorHueso = leer(p.getProperty("calc.polvoPorHueso", "3"), 3);
		// Antes se guardaba en minutos: si solo está ese valor, se pasa a segundos.
		segundosPorMillon = p.getProperty("calc.segundosPorMillon") != null ? leer(p.getProperty("calc.segundosPorMillon"), 240)
				: leer(p.getProperty("calc.minutosPorMillon", "4"), 4) * 60;
		precioRealElitra = leer(p.getProperty("calc.precioRealElitra", "0"), 0);
		horasDia = leer(p.getProperty("calc.horasDia", "8"), 8);
		modoPrecio = Math.clamp((int) leer(p.getProperty("calc.modoPrecio", "0"), 0), 0, 2);
		polvoLeido = leer(p.getProperty("calc.polvoLeido", "-1"), -1);
		polvoCantidad = (int) leer(p.getProperty("calc.polvoCantidad", "1"), 1);
		polvoTexto = p.getProperty("calc.polvoTexto", "");
		polvoCuando = (long) leer(p.getProperty("calc.polvoCuando", "0"), 0);
		elitraMax = leer(p.getProperty("calc.elitraMax", "-1"), -1);
		elitraMin = leer(p.getProperty("calc.elitraMin", "-1"), -1);
		elitrasVistas = (int) leer(p.getProperty("calc.elitrasVistas", "0"), 0);
		elitraTexto = p.getProperty("calc.elitraTexto", "");
		elitraCuando = (long) leer(p.getProperty("calc.elitraCuando", "0"), 0);
		huesoMin = leer(p.getProperty("calc.huesoMin", "-1"), -1);
		huesosVistos = (int) leer(p.getProperty("calc.huesosVistos", "0"), 0);
		huesoTexto = p.getProperty("calc.huesoTexto", "");
		huesoCuando = (long) leer(p.getProperty("calc.huesoCuando", "0"), 0);
	}

	void guardar(Properties p) {
		p.setProperty("calc.precioHueso", String.valueOf(precioHueso));
		p.setProperty("calc.polvoPorHueso", String.valueOf(polvoPorHueso));
		p.setProperty("calc.segundosPorMillon", String.valueOf(segundosPorMillon));
		p.setProperty("calc.precioRealElitra", String.valueOf(precioRealElitra));
		p.setProperty("calc.horasDia", String.valueOf(horasDia));
		p.setProperty("calc.modoPrecio", String.valueOf(modoPrecio));
		p.setProperty("calc.polvoLeido", String.valueOf(polvoLeido));
		p.setProperty("calc.polvoCantidad", String.valueOf(polvoCantidad));
		p.setProperty("calc.polvoTexto", polvoTexto);
		p.setProperty("calc.polvoCuando", String.valueOf(polvoCuando));
		p.setProperty("calc.elitraMax", String.valueOf(elitraMax));
		p.setProperty("calc.elitraMin", String.valueOf(elitraMin));
		p.setProperty("calc.elitrasVistas", String.valueOf(elitrasVistas));
		p.setProperty("calc.elitraTexto", elitraTexto);
		p.setProperty("calc.elitraCuando", String.valueOf(elitraCuando));
		p.setProperty("calc.huesoMin", String.valueOf(huesoMin));
		p.setProperty("calc.huesosVistos", String.valueOf(huesosVistos));
		p.setProperty("calc.huesoTexto", huesoTexto);
		p.setProperty("calc.huesoCuando", String.valueOf(huesoCuando));
	}
}
