package autocraft;

import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.components.StringWidget;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.IntConsumer;
import java.util.function.Supplier;

/** Menú (tecla K): ajustes a la izquierda, elegir qué craftear a la derecha. Se guarda al cerrar. */
class Menu extends Screen {
	private static final int ANCHO = 200, MAX_RESULTADOS = 5;

	private final AutoCraft mod;
	private final List<AutoCraft.Opcion> opciones;
	private final List<Button> resultados = new ArrayList<>();
	private List<AutoCraft.Opcion> encontradas = List.of();
	private boolean venta = false; // pestaña: crafteo o venta

	Menu(AutoCraft mod, List<AutoCraft.Opcion> opciones) {
		super(Component.literal("AutoCraft"));
		this.mod = mod;
		this.opciones = opciones;
		mod.elegir(mod.objetivo); // vuelve a buscar la receta por si la acabas de desbloquear
	}

	@Override
	protected void init() {
		int izq = width / 2 - ANCHO - 5, der = width / 2 + 5, y = 30;
		Button crafteo = addRenderableWidget(Button.builder(Component.literal("Crafteo"), b -> pestaña(false)).bounds(width / 2 - 100, 4, 98, 20).build());
		Button vender = addRenderableWidget(Button.builder(Component.literal("Venta"), b -> pestaña(true)).bounds(width / 2 + 2, 4, 98, 20).build());
		crafteo.active = venta;
		vender.active = !venta;
		AutoCraft.Receta receta = mod.receta(minecraft);
		if (venta) {
			initVenta(izq, der, y, receta);
			return;
		}

		// Izquierda: ajustes
		addRenderableWidget(alternar(izq, y, "Activado", () -> mod.activo, v -> mod.activo = v));
		fila(izq, y += 24, () -> "Cada " + mod.intervalo + " ticks (" + mod.intervalo / 20.0 + " s)",
				d -> mod.intervalo = Math.clamp(mod.intervalo + d, 1, 1200));
		fila(izq, y += 24, () -> "Reserva: " + mod.reserva + " de cada",
				d -> mod.reserva = Math.clamp(mod.reserva + d, 0, 64));
		addRenderableWidget(alternar(izq, y += 24, "Tirar el resultado", () -> mod.tirar, v -> mod.tirar = v));
		addRenderableWidget(alternar(izq, y += 24, "Limpiar inventario", () -> mod.limpiar, v -> mod.limpiar = v));

		if (receta != null) {
			addRenderableWidget(new StringWidget(izq, y += 28, ANCHO, 12, Component.literal("Huecos por ingrediente:"), font));
			y -= 10;
			for (AutoCraft.Grupo g : receta.grupos()) {
				fila(izq, y += 22, () -> g.nombre().getString() + ": " + mod.cupo(g), d -> mod.ponerCupo(g, mod.cupo(g) + d));
			}
		}

		// Derecha: qué craftear
		y = 30;
		Component actual = receta != null ? receta.nombre() : Component.literal(mod.objetivo + " (receta no desbloqueada)");
		addRenderableWidget(new StringWidget(der, y + 6, ANCHO, 12, Component.literal("Creando: ").append(actual), font));
		EditBox caja = addRenderableWidget(new EditBox(font, der, y += 20, ANCHO, 20, Component.literal("Buscar")));
		caja.setHint(Component.literal("Buscar objeto..."));
		caja.setResponder(this::buscar);
		resultados.clear();
		for (int i = 0; i < MAX_RESULTADOS; i++) {
			int n = i;
			Button b = addRenderableWidget(Button.builder(Component.empty(), x -> elegir(n)).bounds(der, y += 22, ANCHO, 20).build());
			b.visible = false;
			resultados.add(b);
		}
		setInitialFocus(caja);
	}

	private void initVenta(int izq, int der, int y, AutoCraft.Receta receta) {
		addRenderableWidget(alternar(izq, y, "Vender", () -> mod.vender, v -> mod.vender = v));
		fila(izq, y += 24, () -> "Cantidad por venta: " + mod.cantidadVenta, d -> mod.cantidadVenta = Math.clamp(mod.cantidadVenta + d, 1, 64));
		fila(izq, y += 24, () -> "Cada " + mod.segundosVenta + " s", d -> mod.segundosVenta = Math.clamp(mod.segundosVenta + d, 1, 3600));
		fila(izq, y += 24, () -> "Hueco de la barra: " + (mod.huecoVenta + 1), d -> mod.huecoVenta = Math.clamp(mod.huecoVenta + d, 0, 8));

		y = 30;
		Component nombre = receta != null ? receta.nombre() : Component.literal(mod.objetivo);
		addRenderableWidget(new StringWidget(der, y + 6, ANCHO, 12, Component.literal("Vende: ").append(nombre), font));
		addRenderableWidget(new StringWidget(der, y += 24, ANCHO, 12, Component.literal("Comando (lo que tengas en la mano):"), font));
		EditBox caja = addRenderableWidget(new EditBox(font, der, y += 14, ANCHO, 20, Component.literal("Comando")));
		caja.setMaxLength(100);
		caja.setValue("/" + mod.comando);
		caja.setResponder(v -> mod.comando = v.trim().replaceFirst("^/", ""));
	}

	private void pestaña(boolean venta) {
		this.venta = venta;
		rebuildWidgets();
	}

	private void buscar(String texto) {
		String q = texto.toLowerCase(Locale.ROOT).trim();
		encontradas = q.isEmpty() ? List.of() : opciones.stream()
				.filter(o -> o.nombre().getString().toLowerCase(Locale.ROOT).contains(q) || o.clave().contains(q))
				.limit(MAX_RESULTADOS).toList();
		for (int i = 0; i < resultados.size(); i++) {
			resultados.get(i).visible = i < encontradas.size();
			if (i < encontradas.size()) resultados.get(i).setMessage(encontradas.get(i).nombre());
		}
	}

	private void elegir(int i) {
		mod.elegir(encontradas.get(i).clave());
		rebuildWidgets();
	}

	private Button alternar(int x, int y, String nombre, BooleanSupplier get, Consumer<Boolean> set) {
		Supplier<Component> texto = () -> Component.literal(nombre + ": " + (get.getAsBoolean() ? "SÍ" : "NO"));
		return Button.builder(texto.get(), b -> {
			set.accept(!get.getAsBoolean());
			b.setMessage(texto.get());
		}).bounds(x, y, ANCHO, 20).build();
	}

	/** Fila "[-] texto [+]". */
	private void fila(int x, int y, Supplier<String> texto, IntConsumer cambiar) {
		StringWidget etiqueta = addRenderableWidget(new StringWidget(x + 24, y + 6, ANCHO - 48, 12, Component.literal(texto.get()), font));
		addRenderableWidget(Button.builder(Component.literal("-"), b -> {
			cambiar.accept(-1);
			etiqueta.setMessage(Component.literal(texto.get()));
		}).bounds(x, y, 20, 20).build());
		addRenderableWidget(Button.builder(Component.literal("+"), b -> {
			cambiar.accept(1);
			etiqueta.setMessage(Component.literal(texto.get()));
		}).bounds(x + ANCHO - 20, y, 20, 20).build());
	}

	@Override
	public void onClose() {
		mod.guardar();
		super.onClose();
	}
}
