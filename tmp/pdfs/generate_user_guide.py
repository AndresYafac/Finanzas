from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "output" / "pdf"
OUT_DIR.mkdir(parents=True, exist_ok=True)
PDF_PATH = OUT_DIR / "Guia-Funcionalidades-Usuario-FinTrack.pdf"
LOGO_PATH = ROOT / "assets" / "icon.png"


PRIMARY = colors.HexColor("#159b73")
PRIMARY_DARK = colors.HexColor("#0f6f55")
INK = colors.HexColor("#102033")
MUTED = colors.HexColor("#5d718a")
SOFT = colors.HexColor("#eef7f4")
LINE = colors.HexColor("#d9e5ef")
WARN = colors.HexColor("#fff4df")


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="CoverTitle",
        parent=styles["Title"],
        textColor=INK,
        fontName="Helvetica-Bold",
        fontSize=28,
        leading=32,
        alignment=TA_CENTER,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="CoverSubtitle",
        parent=styles["Normal"],
        textColor=MUTED,
        fontSize=12,
        leading=16,
        alignment=TA_CENTER,
        spaceAfter=18,
    )
)
styles.add(
    ParagraphStyle(
        name="SectionTitle",
        parent=styles["Heading2"],
        textColor=INK,
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        spaceBefore=12,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="Body",
        parent=styles["BodyText"],
        textColor=INK,
        fontSize=9.6,
        leading=13.5,
        spaceAfter=5,
    )
)
styles.add(
    ParagraphStyle(
        name="Small",
        parent=styles["BodyText"],
        textColor=MUTED,
        fontSize=8.5,
        leading=11.5,
    )
)
styles.add(
    ParagraphStyle(
        name="CardTitle",
        parent=styles["BodyText"],
        textColor=INK,
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=13,
        spaceAfter=3,
    )
)
styles.add(
    ParagraphStyle(
        name="WhiteSmall",
        parent=styles["BodyText"],
        textColor=colors.white,
        fontName="Helvetica-Bold",
        fontSize=9.5,
        leading=12,
        alignment=TA_CENTER,
    )
)


def p(text, style="Body"):
    return Paragraph(text, styles[style])


def bullet(items):
    return ListFlowable(
        [ListItem(p(item, "Body"), leftIndent=8) for item in items],
        bulletType="bullet",
        leftIndent=14,
        bulletFontName="Helvetica",
        bulletFontSize=7,
        bulletColor=PRIMARY,
    )


def card(title, body, color=SOFT):
    table = Table(
        [[p(title, "CardTitle")], [p(body, "Small")]],
        colWidths=[7.7 * cm],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), color),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("ROUNDEDCORNERS", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
            ]
        )
    )
    return table


def section(title, items):
    rows = []
    for item_title, item_body in items:
        rows.append([card(item_title, item_body)])
    return KeepTogether([p(title, "SectionTitle"), Table(rows, rowHeights=None)])


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(doc.leftMargin, height - 1.15 * cm, width - doc.rightMargin, height - 1.15 * cm)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 0.75 * cm, "FinTrack Pro - Guia breve para usuarios")
    canvas.drawRightString(width - doc.rightMargin, 0.75 * cm, f"Pagina {doc.page}")
    canvas.restoreState()


def build():
    doc = SimpleDocTemplate(
        str(PDF_PATH),
        pagesize=A4,
        rightMargin=1.35 * cm,
        leftMargin=1.35 * cm,
        topMargin=1.45 * cm,
        bottomMargin=1.25 * cm,
        title="Guia de funcionalidades de usuario - FinTrack Pro",
        author="FinTrack Pro",
    )

    story = []

    if LOGO_PATH.exists():
        logo = Image(str(LOGO_PATH), width=2.4 * cm, height=2.4 * cm)
        logo.hAlign = "CENTER"
        story += [Spacer(1, 1.1 * cm), logo, Spacer(1, 0.35 * cm)]
    else:
        story += [Spacer(1, 1.5 * cm)]

    story += [
        p("FinTrack Pro", "CoverTitle"),
        p("Guia breve de funcionalidades para usuarios", "CoverSubtitle"),
    ]

    intro = Table(
        [
            [
                p(
                    "Este documento resume las principales funciones del sistema para operar finanzas personales o de negocio: clientes, cuentas, caja, cobros, prestamos, presupuestos, metas, reportes y seguridad.",
                    "Body",
                )
            ]
        ],
        colWidths=[16.2 * cm],
    )
    intro.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SOFT),
                ("BOX", (0, 0), (-1, -1), 0.8, PRIMARY),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 12),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ]
        )
    )
    story += [intro, Spacer(1, 0.55 * cm)]

    flow = Table(
        [
            [
                p("1<br/>Cuentas", "WhiteSmall"),
                p("2<br/>Clientes", "WhiteSmall"),
                p("3<br/>Movimientos", "WhiteSmall"),
                p("4<br/>Cobros / Pagos", "WhiteSmall"),
                p("5<br/>Reportes", "WhiteSmall"),
            ]
        ],
        colWidths=[3.0 * cm] * 5,
        hAlign="CENTER",
    )
    flow.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PRIMARY),
                ("BOX", (0, 0), (-1, -1), 0.5, PRIMARY_DARK),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.white),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story += [flow, Spacer(1, 0.45 * cm)]

    story += [
        p("Acceso y uso inicial", "SectionTitle"),
        bullet(
            [
                "<b>Inicio de sesion:</b> ingresa con correo y contrasena. Si es cuenta nueva, primero confirma el correo recibido.",
                "<b>App movil:</b> puede recordar la cuenta y solicitar PIN de 6 digitos para desbloquear rapidamente.",
                "<b>Permisos:</b> cada usuario ve solo los modulos habilitados por el administrador.",
            ]
        ),
        p("Funciones principales", "SectionTitle"),
    ]

    modules = [
        (
            "Dashboard",
            "Muestra balance consolidado, cuentas por cobrar, cobros del mes e ingresos/egresos. Permite filtrar periodo, exportar PDF, usar modo presentacion y configurar tarjetas o graficos.",
        ),
        (
            "Clientes",
            "Administra personas o empresas relacionadas con tus operaciones. Puedes crear, editar, eliminar, buscar y consultar datos de documento cuando la integracion esta configurada.",
        ),
        (
            "Cuentas y caja",
            "Registra bancos, cajas y billeteras. Las billeteras pueden vincularse a una cuenta bancaria para reflejar el saldo real del banco asociado.",
        ),
        (
            "Movimientos de caja",
            "Registra ingresos y egresos generales indicando fecha, cuenta, monto, categoria y concepto. Incluye filtros, ordenamiento y exportacion a PDF o Excel.",
        ),
        (
            "Cuentas por cobrar",
            "Representa dinero que tus clientes te deben. Se registra el cliente, monto, vencimiento y estado para controlar pendientes y vencidos.",
        ),
        (
            "Cobros recibidos",
            "Registra pagos de clientes. El cobro reduce la cuenta por cobrar y aumenta la cuenta destino seleccionada.",
        ),
        (
            "Prestamos por pagar",
            "Controla dinero que te prestaron y que debes devolver. Si el prestamo es historico, puede registrarse sin alterar el saldo actual.",
        ),
        (
            "Pagos a acreedores",
            "Registra pagos realizados sobre prestamos por pagar. El pago disminuye la cuenta seleccionada y actualiza el saldo pendiente.",
        ),
        (
            "Presupuestos",
            "Define limites por categoria para controlar gastos. El sistema puede alertar cuando un presupuesto se acerca o supera su limite.",
        ),
        (
            "Metas",
            "Permite crear objetivos financieros, controlar avance y revisar metas vencidas o por revisar.",
        ),
        (
            "Reportes",
            "Consulta informacion filtrada por fechas, cliente, cuenta, tipo o categoria. Exporta reportes en PDF, Excel o JSON segun la vista.",
        ),
        (
            "Alertas y notificaciones",
            "La campana muestra alertas internas por saldos bajos, vencimientos, presupuestos y metas. Las notificaciones moviles dependen de permisos del dispositivo y configuracion Android.",
        ),
    ]

    rows = []
    for idx in range(0, len(modules), 2):
        left = modules[idx]
        right = modules[idx + 1] if idx + 1 < len(modules) else ("", "")
        rows.append([card(left[0], left[1]), card(right[0], right[1])])

    grid = Table(rows, colWidths=[8.0 * cm, 8.0 * cm], hAlign="CENTER")
    grid.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story += [grid, PageBreak()]

    story += [
        p("Flujo recomendado de trabajo", "SectionTitle"),
        bullet(
            [
                "<b>1. Configura tus cuentas:</b> bancos, cajas y billeteras antes de registrar operaciones.",
                "<b>2. Registra clientes:</b> crea los clientes que tendran cuentas por cobrar o movimientos relacionados.",
                "<b>3. Registra operaciones:</b> usa movimientos de caja para ingresos/egresos generales, cuentas por cobrar para deudas de clientes y prestamos por pagar para deudas propias.",
                "<b>4. Revisa el dashboard:</b> controla balance, pendientes, cobros y variacion de ingresos/egresos.",
                "<b>5. Exporta reportes:</b> aplica filtros y descarga PDF o Excel para revision o respaldo.",
            ]
        ),
        p("Perfil, seguridad y administracion", "SectionTitle"),
    ]

    admin_rows = [
        [
            card(
                "Mi perfil",
                "Actualiza datos personales: nombre, documento, telefono, direccion, negocio y moneda predeterminada.",
                colors.white,
            ),
            card(
                "Seguridad",
                "Permite cambiar contrasena, configurar PIN movil y cerrar sesiones abiertas cuando sea necesario.",
                colors.white,
            ),
        ],
        [
            card(
                "Usuarios",
                "Solo administradores. Permite ver usuarios registrados, estado, confirmacion de correo, permisos y acciones de activacion o eliminacion.",
                colors.white,
            ),
            card(
                "Permisos",
                "Solo administradores. Define que modulos ve cada usuario y que acciones puede realizar: ver, crear, editar, eliminar o exportar.",
                colors.white,
            ),
        ],
    ]
    admin_grid = Table(admin_rows, colWidths=[8.0 * cm, 8.0 * cm], hAlign="CENTER")
    admin_grid.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story += [admin_grid, Spacer(1, 0.4 * cm)]

    story += [
        p("Buenas practicas", "SectionTitle"),
        bullet(
            [
                "Revisa el saldo de cuentas despues de registrar ingresos, egresos, cobros o pagos.",
                "Usa categorias claras para que los reportes tengan sentido.",
                "Marca alertas como leidas cuando ya fueron atendidas.",
                "No compartas claves de Supabase ni credenciales administrativas.",
                "Antes de eliminar informacion, exporta un reporte si necesitas respaldo.",
            ]
        ),
    ]

    note = Table(
        [
            [
                p(
                    f"Documento generado el {date.today().strftime('%d/%m/%Y')}. Algunas funciones pueden depender del rol del usuario, permisos asignados y configuracion del proyecto.",
                    "Small",
                )
            ]
        ],
        colWidths=[16.2 * cm],
    )
    note.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), WARN),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#f0d28a")),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story += [Spacer(1, 0.35 * cm), note]

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(PDF_PATH)


if __name__ == "__main__":
    build()
