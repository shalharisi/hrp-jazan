import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  convertInchesToTwip,
  ImageRun,
  TableOfContents,
  StyleLevel,
  LevelFormat,
  UnderlineType,
} from "docx";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(__dirname, "دليل_المستخدم_منظومة_جازان.docx");
const LOGO_PATH = path.resolve(__dirname, "../../artifacts/hrp-tracker/src/assets/logo.jpg");

// ── Color palette ────────────────────────────────────────────────────────────
const GREEN = "1A7A4A";
const GREEN_LIGHT = "E8F5EE";
const GREEN_MID = "006633";
const WHITE = "FFFFFF";
const GRAY_DARK = "374151";
const GRAY_MID = "6B7280";
const GRAY_LIGHT = "F9FAFB";
const RED_LIGHT = "FEE2E2";
const RED_DARK = "991B1B";
const YELLOW_LIGHT = "FEF9C3";
const YELLOW_DARK = "854D0E";
const BLUE_LIGHT = "DBEAFE";
const BLUE_DARK = "1E40AF";

// ── Helper: Paragraph with RTL ────────────────────────────────────────────────
function rtlPara(
  text: string,
  opts: {
    bold?: boolean;
    size?: number;
    color?: string;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacing?: { before?: number; after?: number };
    indent?: { start?: number };
    italic?: boolean;
    underline?: boolean;
  } = {}
): Paragraph {
  return new Paragraph({
    bidirectional: true,
    alignment: opts.alignment ?? AlignmentType.RIGHT,
    spacing: { before: opts.spacing?.before ?? 80, after: opts.spacing?.after ?? 80 },
    indent: opts.indent,
    children: [
      new TextRun({
        text,
        bold: opts.bold ?? false,
        size: opts.size ?? 24,
        color: opts.color ?? GRAY_DARK,
        font: "Calibri",
        italics: opts.italic ?? false,
        underline: opts.underline ? { type: UnderlineType.SINGLE } : undefined,
      }),
    ],
  });
}

// ── Helper: Heading (uses HeadingLevel so Word TOC auto-populates) ────────────
function sectionHeading(text: string, level: 1 | 2 | 3 = 1): Paragraph {
  const sizeMap = { 1: 36, 2: 28, 3: 24 };
  const spaceBefore = { 1: 360, 2: 240, 3: 160 };
  const headingLevelMap = {
    1: HeadingLevel.HEADING_1,
    2: HeadingLevel.HEADING_2,
    3: HeadingLevel.HEADING_3,
  };
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    heading: headingLevelMap[level],
    spacing: { before: spaceBefore[level], after: 120 },
    shading:
      level === 1
        ? { type: ShadingType.SOLID, color: GREEN_LIGHT, fill: GREEN_LIGHT }
        : undefined,
    border:
      level === 1
        ? {
            bottom: {
              color: GREEN_MID,
              space: 1,
              style: BorderStyle.THICK,
              size: 6,
            },
          }
        : undefined,
    children: [
      new TextRun({
        text,
        bold: true,
        size: sizeMap[level],
        color: GREEN_MID,
        font: "Calibri",
      }),
    ],
  });
}

// ── Helper: Bullet point ─────────────────────────────────────────────────────
function bullet(text: string, sub = false): Paragraph {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 60, after: 60 },
    indent: { start: convertInchesToTwip(sub ? 0.8 : 0.4) },
    children: [
      new TextRun({
        text: `${sub ? "◦" : "•"} ${text}`,
        size: 22,
        color: GRAY_DARK,
        font: "Calibri",
      }),
    ],
  });
}

// ── Helper: Note / Tip box ────────────────────────────────────────────────────
function noteBox(text: string, type: "info" | "warning" | "tip" = "info"): Paragraph {
  const icons = { info: "ℹ️", warning: "⚠️", tip: "💡" };
  const colors = { info: BLUE_LIGHT, warning: YELLOW_LIGHT, tip: GREEN_LIGHT };
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 120, after: 120 },
    shading: { type: ShadingType.SOLID, color: colors[type], fill: colors[type] },
    border: {
      right: { color: GREEN_MID, space: 4, style: BorderStyle.THICK, size: 8 },
    },
    children: [
      new TextRun({
        text: `${icons[type]}  ${text}`,
        size: 22,
        color: GRAY_DARK,
        font: "Calibri",
      }),
    ],
  });
}

// ── Helper: Screenshot placeholder ──────────────────────────────────────────
function screenshotPlaceholder(caption: string): Paragraph[] {
  return [
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      shading: { type: ShadingType.SOLID, color: "F3F4F6", fill: "F3F4F6" },
      border: {
        top: { color: "D1D5DB", space: 1, style: BorderStyle.SINGLE, size: 4 },
        bottom: { color: "D1D5DB", space: 1, style: BorderStyle.SINGLE, size: 4 },
        left: { color: "D1D5DB", space: 1, style: BorderStyle.SINGLE, size: 4 },
        right: { color: "D1D5DB", space: 1, style: BorderStyle.SINGLE, size: 4 },
      },
      children: [
        new TextRun({
          text: `[ لقطة شاشة: ${caption} ]`,
          size: 20,
          color: GRAY_MID,
          font: "Calibri",
          italics: true,
        }),
      ],
    }),
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 120 },
      children: [
        new TextRun({
          text: caption,
          size: 18,
          color: GRAY_MID,
          font: "Calibri",
          italics: true,
        }),
      ],
    }),
  ];
}

// ── Helper: Simple 2-column info table ──────────────────────────────────────
function infoTable(rows: [string, string][], header?: string): Table {
  const tableRows: TableRow[] = [];

  if (header) {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            shading: { type: ShadingType.SOLID, color: GREEN_MID, fill: GREEN_MID },
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: header,
                    bold: true,
                    size: 22,
                    color: WHITE,
                    font: "Calibri",
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  rows.forEach(([label, value], i) => {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            shading: i % 2 === 0
              ? { type: ShadingType.SOLID, color: GREEN_LIGHT, fill: GREEN_LIGHT }
              : undefined,
            borders: {
              top: { style: BorderStyle.SINGLE, color: "E5E7EB", size: 2 },
              bottom: { style: BorderStyle.SINGLE, color: "E5E7EB", size: 2 },
              left: { style: BorderStyle.SINGLE, color: "E5E7EB", size: 2 },
              right: { style: BorderStyle.SINGLE, color: "E5E7EB", size: 2 },
            },
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: label,
                    bold: true,
                    size: 20,
                    color: GRAY_DARK,
                    font: "Calibri",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            shading: i % 2 === 0
              ? undefined
              : { type: ShadingType.SOLID, color: GRAY_LIGHT, fill: GRAY_LIGHT },
            borders: {
              top: { style: BorderStyle.SINGLE, color: "E5E7EB", size: 2 },
              bottom: { style: BorderStyle.SINGLE, color: "E5E7EB", size: 2 },
              left: { style: BorderStyle.SINGLE, color: "E5E7EB", size: 2 },
              right: { style: BorderStyle.SINGLE, color: "E5E7EB", size: 2 },
            },
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: value,
                    size: 20,
                    color: GRAY_DARK,
                    font: "Calibri",
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
  });
}

// ── Helper: Page break ──────────────────────────────────────────────────────
function pageBreak(): Paragraph {
  return new Paragraph({
    children: [new PageBreak()],
  });
}

// ── Build document ────────────────────────────────────────────────────────────
async function buildDocument(): Promise<Buffer> {
  // Load logo if available
  let logoImage: ImageRun | null = null;
  if (fs.existsSync(LOGO_PATH)) {
    const logoData = fs.readFileSync(LOGO_PATH);
    logoImage = new ImageRun({
      data: logoData,
      transformation: { width: 110, height: 110 },
      type: "jpg",
    });
  }

  const sections: (Paragraph | Table | TableOfContents)[] = [];

  // ============================================================
  // COVER PAGE
  // ============================================================
  sections.push(
    new Paragraph({ children: [] }),
    new Paragraph({ children: [] }),
    new Paragraph({ children: [] }),
  );

  if (logoImage) {
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [logoImage],
      })
    );
  } else {
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [
          new TextRun({
            text: "[ شعار تجمع جازان الصحي ]",
            size: 22,
            color: GRAY_MID,
            italics: true,
            font: "Calibri",
          }),
        ],
      })
    );
  }

  sections.push(
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({
          text: "المملكة العربية السعودية",
          size: 24,
          color: GRAY_MID,
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 200 },
      children: [
        new TextRun({
          text: "وزارة الصحة – تجمع جازان الصحي",
          size: 26,
          bold: true,
          color: GREEN_MID,
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 120 },
      shading: { type: ShadingType.SOLID, color: GREEN_MID, fill: GREEN_MID },
      children: [
        new TextRun({
          text: "دليل المستخدم الشامل",
          size: 52,
          bold: true,
          color: WHITE,
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: "منظومة تتبع الحمل عالي الخطورة",
          size: 40,
          bold: true,
          color: GREEN_MID,
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 400 },
      children: [
        new TextRun({
          text: "تجمع جازان الصحي 2026",
          size: 30,
          color: GRAY_MID,
          font: "Calibri",
        }),
      ],
    }),
    infoTable([
      ["الإصدار", "1.0"],
      ["تاريخ الإصدار", "مايو 2026"],
      ["الجهة المُصدِرة", "تجمع جازان الصحي – إدارة المعلومات الصحية"],
      ["الفئة المستهدفة", "منسقو الحوامل عالي الخطورة، الأطباء، المسؤولون"],
      ["لغة الدليل", "العربية (RTL) – مع مصطلحات إنجليزية متخصصة"],
    ]),
    pageBreak()
  );

  // ============================================================
  // DISCLAIMER PAGE
  // ============================================================
  sections.push(
    sectionHeading("إخلاء المسؤولية وبيانات التواصل", 1),
    rtlPara(
      "هذا الدليل معدّ للمستخدمين المصرح لهم فقط ضمن منظومة تتبع الحمل عالي الخطورة التابعة لتجمع جازان الصحي. " +
      "المعلومات الواردة فيه سرية ومخصصة للاستخدام الداخلي. يُحظر نشرها أو توزيعها خارج نطاق المنظومة.",
      { spacing: { before: 120, after: 80 } }
    ),
    rtlPara(
      "جميع العمليات المُنفَّذة داخل المنظومة مُسجَّلة وفق متطلبات نظام حماية البيانات الشخصية (PDPL) في المملكة العربية السعودية.",
      { spacing: { before: 80, after: 120 } }
    ),
    sectionHeading("بيانات التواصل", 2),
    infoTable([
      ["الجهة المسؤولة", "إدارة المعلومات الصحية – تجمع جازان الصحي"],
      ["البريد الإلكتروني", "his@jazan-health.gov.sa"],
      ["الهاتف", "17xxxxxxxx – داخلي 1xx"],
      ["ساعات الدعم", "الأحد – الخميس، 7:30 ص – 3:30 م"],
    ]),
    pageBreak()
  );

  // ============================================================
  // TABLE OF CONTENTS (automatic field)
  // ============================================================
  sections.push(
    sectionHeading("فهرس المحتويات", 1),
    new TableOfContents("فهرس المحتويات", {
      hyperlink: true,
      headingStyleRange: "1-3",
      stylesWithLevels: [
        new StyleLevel("Heading1", 1),
        new StyleLevel("Heading2", 2),
        new StyleLevel("Heading3", 3),
      ],
    }),
    rtlPara(
      "ملاحظة: لتحديث الفهرس بعد فتح الملف في Word، انقر بالزر الأيمن على الفهرس واختر «تحديث الحقل» (Update Field).",
      { italic: true, color: GRAY_MID, spacing: { before: 80, after: 80 } }
    ),
    pageBreak()
  );

  // ============================================================
  // SECTION 1: OVERVIEW
  // ============================================================
  sections.push(
    sectionHeading("القسم الأول: نظرة عامة على المنظومة", 1),
    sectionHeading("1.1 الهدف والغاية", 2),
    rtlPara(
      "منظومة تتبع الحمل عالي الخطورة هي نظام إلكتروني متكامل يهدف إلى استبدال نموذج العمل القائم على ملفات Excel والنماذج الورقية " +
      "(Microsoft Forms) بمنصة رقمية مركزية لإدارة ومتابعة حالات الحمل عالي الخطورة في تجمع جازان الصحي.",
      { spacing: { before: 120, after: 80 } }
    ),
    sectionHeading("1.2 الفوائد الرئيسية", 2),
    bullet("تتبع آني لحالات الحمل عالي الخطورة عبر جميع المراكز الصحية والمستشفيات في المنطقة"),
    bullet("تصنيف آلي لدرجة الخطورة وحساب مؤشر الالتزام بالمواعيد"),
    bullet("تنبيهات فورية للحالات الحرجة التي تحتاج تدخلًا طارئًا"),
    bullet("لوحة إحصاءات شاملة تعكس الأداء الصحي للقطاع"),
    bullet("تصدير البيانات بصيغة CSV للتحليل والتقارير الدورية"),
    bullet("واجهة ثنائية اللغة (العربية / الإنجليزية) مع دعم اتجاه RTL"),
    sectionHeading("1.3 الفئات المستهدفة", 2),
    infoTable([
      ["منسق الحوامل عالي الخطورة", "الوصول الكامل: تسجيل المرضى، إدارة الحالات، المواعيد، التقارير"],
      ["الطبيب (Doctor)", "إدارة الحالات السريرية، تسجيل الزيارات، تصدير البيانات"],
      ["المسؤول (Admin)", "كل الصلاحيات + إدارة المستخدمين والحسابات"],
      ["المشاهد (Viewer)", "قراءة البيانات فقط، بدون تعديل"],
    ], "الأدوار والصلاحيات"),
    sectionHeading("1.4 متطلبات التشغيل", 2),
    infoTable([
      ["المتصفح", "Chrome 110+ أو Edge 110+ أو Firefox 110+ (يُوصى بـ Chrome)"],
      ["الجهاز", "حاسب مكتبي أو لابتوب أو جهاز لوحي (الشاشة لا تقل عن 10 بوصة)"],
      ["الاتصال", "اتصال بإنترنت مستقر (الشبكة الداخلية للمنشأة مُفضَّلة)"],
      ["التطبيق المحمول", "Android 8+ أو iOS 13+ عبر تطبيق Expo المرافق"],
    ]),
    noteBox("لا يلزم تثبيت أي برنامج على الجهاز للنسخة الإلكترونية؛ يكفي فتح الرابط في المتصفح.", "tip"),
    pageBreak()
  );

  // ============================================================
  // SECTION 2: LOGIN
  // ============================================================
  sections.push(
    sectionHeading("القسم الثاني: تسجيل الدخول وإدارة الجلسة", 1),
    sectionHeading("2.1 شاشة تسجيل الدخول", 2),
    rtlPara(
      "عند فتح رابط المنظومة يظهر للمستخدم شاشة تسجيل الدخول الآمنة. " +
      "تعرض الشاشة شعار تجمع جازان الصحي، واسم المنظومة، وحقلَي اسم المستخدم وكلمة المرور."
    ),
    ...screenshotPlaceholder("شاشة تسجيل الدخول – منظومة تتبع الحمل عالي الخطورة"),
    sectionHeading("2.2 خطوات تسجيل الدخول", 2),
    bullet("أدخِل اسم المستخدم المُخصَّص لك في حقل «اسم المستخدم»"),
    bullet("أدخِل كلمة المرور السرية في حقل «كلمة المرور»"),
    bullet("اضغط زر «تسجيل الدخول»"),
    bullet("في حال صحة البيانات، ستنتقل مباشرةً إلى لوحة المعلومات الرئيسية"),
    noteBox("إذا نسيت كلمة المرور، تواصل مع مسؤول المنظومة (Admin) لإعادة تعيينها.", "warning"),
    sectionHeading("2.3 سياسة الجلسة والأمان", 2),
    infoTable([
      ["مدة الجلسة", "تبقى الجلسة نشطة ما دمت تتفاعل مع المنظومة"],
      ["انتهاء الجلسة", "تنتهي الجلسة تلقائيًا عند توقف النشاط لفترة طويلة"],
      ["تسجيل الخروج", "اضغط على أيقونة المستخدم في أعلى الشريط الجانبي ثم «تسجيل الخروج»"],
      ["الأمان", "جميع العمليات مُسجَّلة وفق نظام PDPL"],
    ]),
    sectionHeading("2.4 تبديل اللغة", 2),
    rtlPara(
      "يمكن التبديل بين العربية والإنجليزية من أيقونة اللغة الموجودة في أعلى الشريط الجانبي. " +
      "تُحفَظ تفضيلات اللغة تلقائيًا في المتصفح."
    ),
    pageBreak()
  );

  // ============================================================
  // SECTION 3: DASHBOARD
  // ============================================================
  sections.push(
    sectionHeading("القسم الثالث: لوحة المعلومات (Dashboard)", 1),
    rtlPara(
      "لوحة المعلومات هي الصفحة الرئيسية التي تعرض فور تسجيل الدخول. " +
      "تُلخِّص الوضع الصحي الحالي لجميع حالات الحمل عالي الخطورة في المنطقة من خلال بطاقات إحصائية ومخططات بيانية."
    ),
    ...screenshotPlaceholder("لوحة المعلومات الرئيسية مع البطاقات الإحصائية والمخططات"),
    sectionHeading("3.1 البطاقات الإحصائية الأربع", 2),
    infoTable([
      ["إجمالي المرضى", "عدد جميع الحوامل المسجلات في المنظومة"],
      ["إجمالي الحالات", "عدد حالات الحمل المُسجَّلة (قد تتعدد الحالات للمريضة الواحدة)"],
      ["الحالات الحرجة", "عدد الحالات ذات مستوى الخطورة «حرج»، مع عرض عدد من ليس لديها موعد"],
      ["نسبة الالتزام بالمواعيد", "نسبة الحالات التي حجزت موعدًا خلال يومَي عمل من تاريخ الزيارة"],
    ], "البطاقات الإحصائية ومعانيها"),
    sectionHeading("3.2 المخططات البيانية", 2),
    sectionHeading("3.2.1 توزيع مستوى الخطورة (Pie Chart)", 3),
    rtlPara(
      "مخطط دائري يوضح توزيع الحالات حسب مستوى الخطورة الأربعة: " +
      "منخفض (أخضر)، متوسط (أصفر)، عالٍ (برتقالي)، حرج (أحمر)."
    ),
    ...screenshotPlaceholder("المخطط الدائري – توزيع مستويات الخطورة"),
    sectionHeading("3.2.2 الالتزام بالمواعيد (Bar Chart)", 3),
    rtlPara(
      "مخطط أعمدة يعرض عدد الحالات الملتزمة (أخضر)، غير الملتزمة (أحمر)، والمعلقة (رمادي) انتظارًا لموعد."
    ),
    ...screenshotPlaceholder("مخطط الأعمدة – حالة الالتزام بالمواعيد"),
    sectionHeading("3.3 شريط التنبيه العاجل", 2),
    rtlPara(
      "يظهر شريط تنبيه برتقالي في أعلى الصفحة عندما يتجاوز عدد المواعيد المنقضية غير المُسجَّل حضورها حدَّ الإنذار (الافتراضي: 5 مواعيد). " +
      "يمكن الضغط على «عرض المواعيد» للانتقال مباشرةً لقائمة الحالات التي تحتاج متابعة، أو الضغط على × لإغلاق الشريط مؤقتًا."
    ),
    noteBox("حدّ الإنذار قابل للتخصيص من صفحة الإعدادات من قِبَل المسؤول أو المنسق.", "info"),
    pageBreak()
  );

  // ============================================================
  // SECTION 4: PATIENTS
  // ============================================================
  sections.push(
    sectionHeading("القسم الرابع: إدارة المرضى", 1),
    sectionHeading("4.1 قائمة المرضى", 2),
    rtlPara(
      "تعرض صفحة «المرضى» قائمةً كاملةً بجميع الحوامل المُسجَّلات. " +
      "تشمل كل بطاقة: الاسم، رقم الهوية الوطنية، رقم الجوال، المركز الصحي، والقطاع."
    ),
    ...screenshotPlaceholder("قائمة المرضى مع خيارات البحث والتصفية"),
    sectionHeading("4.2 البحث والتصفية", 2),
    infoTable([
      ["البحث النصي", "البحث باسم المريضة أو رقم هويتها في حقل البحث"],
      ["تصفية بالمستشفى", "اختر مستشفى لعرض مريضات مرتبطات بقطاعاته"],
      ["تصفية بالقطاع", "تصفية تبعية للمستشفى المختار"],
      ["تصفية بالمركز الصحي", "تصفية تبعية للقطاع المختار"],
      ["إزالة الفلاتر", "زر «مسح الفلاتر» يُعيد عرض جميع المرضى"],
    ], "خيارات البحث والتصفية"),
    sectionHeading("4.3 تسجيل مريضة جديدة", 2),
    rtlPara(
      "اضغط زر «تسجيل مريضة جديدة» (الأخضر) في أعلى يمين الصفحة. " +
      "ستنتقل إلى نموذج التسجيل."
    ),
    ...screenshotPlaceholder("نموذج تسجيل مريضة جديدة"),
    sectionHeading("4.3.1 الحقول المطلوبة", 3),
    infoTable([
      ["رقم الهوية الوطنية (*)", "10 أرقام فقط – لا يمكن تكراره في المنظومة"],
      ["الاسم بالعربية (*)", "الاسم الكامل"],
      ["رقم الجوال (*)", "بصيغة 05XXXXXXXX"],
      ["القطاع (*)", "اختر من القائمة المنسدلة"],
      ["المركز الصحي (*)", "يظهر بعد اختيار القطاع – اختر المركز المناسب"],
    ]),
    sectionHeading("4.3.2 الحقول الاختيارية", 3),
    infoTable([
      ["تاريخ الميلاد", "يُحسَب العمر تلقائيًا من هذا التاريخ"],
      ["جوال الطبيب", "رقم تواصل الطبيب المسؤول"],
      ["العنوان", "عنوان السكن"],
    ]),
    noteBox("بعد حفظ البيانات، تنتقل مباشرةً إلى ملف المريضة حيث يمكنك إضافة حالة حمل جديدة.", "tip"),
    sectionHeading("4.4 عرض ملف المريضة وتعديله", 2),
    rtlPara(
      "اضغط على اسم المريضة في القائمة للانتقال إلى ملفها الكامل. يعرض الملف:"
    ),
    bullet("بيانات المريضة الشخصية (مع إمكانية التعديل بالضغط على «تعديل»)"),
    bullet("قائمة جميع حالات الحمل المُسجَّلة لها مع مستوى الخطورة وحالة الالتزام"),
    bullet("زر «إضافة حالة حمل جديدة»"),
    ...screenshotPlaceholder("ملف المريضة – البيانات الشخصية وقائمة الحالات"),
    pageBreak()
  );

  // ============================================================
  // SECTION 5: PREGNANCIES
  // ============================================================
  sections.push(
    sectionHeading("القسم الخامس: إدارة حالات الحمل", 1),
    sectionHeading("5.1 إضافة حالة حمل جديدة", 2),
    rtlPara(
      "يمكن إضافة حالة حمل جديدة بطريقتين: من ملف المريضة مباشرةً بالضغط «إضافة حالة حمل»، " +
      "أو من قائمة «الحالات» ثم «حالة جديدة». في كلتا الحالتين يظهر نموذج البحث عن المريضة أولًا."
    ),
    sectionHeading("5.1.1 البحث عن المريضة برقم الهوية", 3),
    rtlPara(
      "أدخِل رقم الهوية الوطنية (10 أرقام) في حقل البحث، ثم اضغط «بحث». " +
      "إذا وُجدت المريضة في النظام ستظهر بياناتها، وإلا سيظهر تنبيه «غير موجودة»."
    ),
    ...screenshotPlaceholder("البحث عن مريضة برقم الهوية قبل تسجيل حالة حمل"),
    sectionHeading("5.2 مستويات تصنيف الخطورة", 2),
    infoTable([
      ["منخفض (Low)", "لا توجد عوامل خطر مؤثرة – متابعة روتينية في المركز الصحي"],
      ["متوسط (Medium)", "عوامل خطر محدودة – متابعة مكثفة في المركز الصحي"],
      ["عالٍ (High)", "عوامل خطر متعددة أو حادة – إحالة للمستشفى"],
      ["حرج (Critical)", "حالة طارئة تستدعي تدخلًا فوريًا – إحالة لـ KFCH أو أقرب مستشفى"],
    ], "مستويات الخطورة ومعاييرها"),
    sectionHeading("5.3 عوامل الخطر", 2),
    sectionHeading("5.3.1 المجموعة الأولى – عوامل سابقة للحمل", 3),
    bullet("تعدد الأجنة"),
    bullet("عمر الأم فوق 40 أو أقل من 16"),
    bullet("BMI 35 أو أكثر"),
    bullet("حمل IVF أو تدخينها"),
    bullet("نتائج فحص الفصل الأول إيجابية"),
    bullet("3 إجهاضات أو أكثر، ولادة مبكرة سابقة، وفاة جنينية سابقة"),
    bullet("عملية قيصرية سابقة، سوابق تسمم الحمل، جلطات وريدية سابقة"),
    bullet("سابقة إصابة بنزيف ما بعد الولادة"),
    sectionHeading("5.3.2 المجموعة الثانية – مضاعفات الحمل الحالي", 3),
    bullet("ارتفاع ضغط الدم الحملي"),
    bullet("تسمم الحمل / الإرعاش"),
    bullet("داء السكري الحملي"),
    bullet("انفصال المشيمة، المشيمة المنزاحة"),
    bullet("تأخر النمو داخل الرحم (IUGR)"),
    bullet("نقص أو زيادة السائل الأمنيوسي"),
    bullet("تمزق الأغشية المبكر (PPROM)، نزيف ما قبل الولادة"),
    bullet("هيموغلوبين منخفض (Hb < 9)"),
    sectionHeading("5.3.3 المجموعة الثالثة – الأمراض المزمنة", 3),
    bullet("داء السكري النوع الأول أو الثاني، ارتفاع ضغط الدم المزمن"),
    bullet("أمراض القلب، الكلى، الغدة الدرقية، الكبد"),
    bullet("الصرع، الأمراض المناعية الذاتية، الربو الشديد"),
    bullet("الاكتئاب والاضطرابات النفسية"),
    bullet("فقر الدم المنجلي أو الثلاسيميا، السرطان"),
    sectionHeading("5.4 الحقول السريرية", 2),
    infoTable([
      ["تاريخ الزيارة (*)", "تاريخ الفحص السريري الأول – يُحسَب الالتزام انطلاقًا منه"],
      ["تاريخ آخر دورة شهرية (LMP)", "اختياري – يُستخدم لحساب عمر الحمل"],
      ["عمر الحمل (أسابيع)", "اختياري – بالأسابيع"],
      ["درجة الخطورة (*)", "اختر من: منخفض / متوسط / عالٍ / حرج"],
      ["اسم الطبيب", "اختياري"],
      ["VTE عالي الخطورة", "مربع اختيار – للحالات ذات خطر التجلط الوريدي"],
      ["Enoxaparin موصوف", "مربع اختيار – هل وُصف دواء إنوكساباريين؟"],
      ["توصية الإحالة (*)", "متابعة في المركز / في المستشفى / تحويل لـ KFCH"],
      ["المستشفى المُحوَّل إليه", "اختياري عند الإحالة"],
      ["تاريخ موعد المستشفى", "تاريخ الموعد المحجوز في المستشفى"],
      ["الأدوية", "اذكر الأدوية الموصوفة إن وُجدت"],
      ["ملاحظات عامة", "أي ملاحظات سريرية إضافية"],
      ["ملاحظات المتابعة والتواصل", "سجّل هنا ردود المريضة على التواصل"],
    ], "الحقول السريرية في نموذج الحمل"),
    sectionHeading("5.5 حساب الالتزام بالمواعيد", 2),
    rtlPara(
      "تحسب المنظومة تلقائيًا مؤشر الالتزام بناءً على الفرق بين تاريخ الزيارة وتاريخ الموعد المحجوز، " +
      "مع استثناء أيام الجمعة والسبت (عطلة نهاية الأسبوع السعودية)."
    ),
    infoTable([
      ["ملتزم ✅", "تم حجز الموعد في غضون يومَي عمل أو أقل من تاريخ الزيارة"],
      ["غير ملتزم ❌", "تم حجز الموعد بعد أكثر من يومَي عمل من تاريخ الزيارة"],
      ["بانتظار موعد ⏳", "لم يُحجز أي موعد بعد"],
    ], "قيم مؤشر الالتزام"),
    sectionHeading("5.6 تصدير ملف المريضة بصيغة PDF", 2),
    rtlPara(
      "من صفحة تفاصيل الحالة، اضغط زر «تصدير PDF» لفتح نافذة طباعة تحتوي على الملف الكامل للمريضة: " +
      "البيانات الشخصية، المعلومات السريرية، عوامل الخطر، الأدوية، المواعيد. يمكن طباعته أو حفظه بصيغة PDF."
    ),
    ...screenshotPlaceholder("تفاصيل حالة الحمل – وضع العرض مع زر تصدير PDF"),
    pageBreak()
  );

  // ============================================================
  // SECTION 6: APPOINTMENTS
  // ============================================================
  sections.push(
    sectionHeading("القسم السادس: المواعيد", 1),
    rtlPara(
      "صفحة المواعيد هي المحور الرئيسي لمتابعة حضور الحوامل في المستشفيات. " +
      "تعرض جميع المواعيد المحجوزة مع إمكانية التصفية والبحث وتسجيل الحضور والتصدير."
    ),
    ...screenshotPlaceholder("صفحة المواعيد – القائمة الكاملة مع خيارات التصفية"),
    sectionHeading("6.1 خيارات التصفية", 2),
    infoTable([
      ["تصفية بالتاريخ", "اليوم / هذا الأسبوع / كل المواعيد / نطاق مخصص"],
      ["تصفية بالحالة", "كل المواعيد / مجدول ⏳ / حضر ✅ / غائب ❌ / تحتاج متابعة"],
      ["تصفية بالقطاع", "اختر قطاعًا لعرض مواعيد قطاع محدد"],
      ["تصفية بمستوى الخطورة", "حرج / عالٍ / متوسط / منخفض"],
    ], "خيارات التصفية المتاحة"),
    noteBox(
      "فلتر «تحتاج متابعة» يعرض المواعيد المنقضية التي لم يُسجَّل فيها حضور أو غياب – هذه هي الأولوية القصوى.",
      "warning"
    ),
    sectionHeading("6.2 تسجيل الحضور", 2),
    rtlPara(
      "لتسجيل حضور مريضة أو غيابها، ابحث عنها في القائمة ثم:"
    ),
    bullet("اضغط أيقونة ✅ لتسجيل الحضور، أو ❌ لتسجيل الغياب"),
    bullet("تظهر نافذة تأكيد تتيح لك إضافة ملاحظة حضور (مثل: «حضرت متأخرة» أو «اعتذرت لظرف طارئ»)"),
    bullet("اضغط «حفظ» لتثبيت حالة الحضور"),
    ...screenshotPlaceholder("نافذة تسجيل الحضور مع حقل الملاحظة"),
    sectionHeading("6.3 الإحصاءات الآنية", 2),
    rtlPara(
      "يعرض أعلى الصفحة ثلاث بطاقات إحصائية تُحدَّث فور تطبيق أي فلتر:"
    ),
    bullet("عدد المواعيد المجدولة (⏳)"),
    bullet("عدد من حضروا (✅)"),
    bullet("عدد الغائبين (❌)"),
    sectionHeading("6.4 تصدير CSV", 2),
    rtlPara(
      "اضغط زر «تصدير CSV» لتنزيل جميع المواعيد المعروضة حاليًا (بعد تطبيق الفلاتر) في ملف CSV. " +
      "يتضمن الملف: اسم المريضة، الهوية، القطاع، المستشفى، التاريخ، الحالة، الملاحظة."
    ),
    noteBox("يُنصح بفتح ملف CSV في Excel باستخدام ترميز UTF-8 للحصول على النص العربي بشكل صحيح.", "tip"),
    sectionHeading("6.5 الطباعة", 2),
    rtlPara(
      "اضغط زر «طباعة» لفتح نافذة طباعة جاهزة تعرض جدول المواعيد مع ملخص الفلاتر المطبقة وتاريخ الطباعة."
    ),
    ...screenshotPlaceholder("نافذة طباعة جدول المواعيد"),
    sectionHeading("6.6 شارة مستوى الخطورة في المواعيد", 2),
    rtlPara(
      "تظهر بجانب كل موعد شارة ملونة تعكس مستوى خطورة الحالة: أحمر غامق للحرج، برتقالي للعالي، أصفر للمتوسط، أخضر للمنخفض. " +
      "هذا يُساعد المنسق في تحديد أولويات المتابعة."
    ),
    pageBreak()
  );

  // ============================================================
  // SECTION 7: ALERTS
  // ============================================================
  sections.push(
    sectionHeading("القسم السابع: التنبيهات", 1),
    rtlPara(
      "صفحة التنبيهات تعرض الحالات التي تستوجب تدخلًا عاجلًا. تُحسَب التنبيهات تلقائيًا في كل طلب دون الحاجة لجدولة وظائف مستقلة."
    ),
    ...screenshotPlaceholder("صفحة التنبيهات – قائمة الحالات الحرجة"),
    sectionHeading("7.1 أنواع التنبيهات", 2),
    infoTable([
      ["VTE بدون إنوكساباريين", "حالة مصنفة كـ VTE عالي الخطورة لكن لم يُوصَف لها إنوكساباريين"],
      ["حرج بدون موعد", "حالة بمستوى «حرج» ليس لها أي موعد مستشفى مسجّل"],
      ["موعد فائت", "موعد انقضى تاريخه دون تسجيل حضور أو غياب"],
      ["متأخر حرج (Overdue Critical)", "حالة حرجة بموعد منقضٍ لم يُعالج"],
    ], "أنواع التنبيهات الأربعة"),
    sectionHeading("7.2 درجات خطورة التنبيه", 2),
    infoTable([
      ["حرج (Critical) – حد أحمر", "يتطلب تدخلًا فوريًا – لا يمكن تأجيله"],
      ["تحذير (Warning) – حد برتقالي", "يتطلب متابعة خلال يوم عمل"],
    ]),
    sectionHeading("7.3 كيفية معالجة التنبيه", 2),
    bullet("اضغط على اسم المريضة في التنبيه للانتقال مباشرةً إلى ملف حالتها"),
    bullet("راجع البيانات السريرية وأكمل المعلومات الناقصة (موعد، دواء، ملاحظة)"),
    bullet("بعد تحديث الحالة سيختفي التنبيه تلقائيًا عند تحديث الصفحة"),
    noteBox("إذا كانت صفحة التنبيهات فارغة، فهذا يعني أن كل الحالات مستوفية المتطلبات – وهو الهدف المثالي.", "tip"),
    pageBreak()
  );

  // ============================================================
  // SECTION 8: REPORTS
  // ============================================================
  sections.push(
    sectionHeading("القسم الثامن: التقارير والتصدير", 1),
    rtlPara(
      "صفحة التقارير توفر أدوات تصدير بيانات المنظومة بصيغة CSV (متوافقة مع Excel) وطباعة/حفظ كـ PDF، " +
      "لاستخدامها في التحليل والتقارير الدورية. تتاح هذه الميزة للمديرين والمنسقين والأطباء فقط."
    ),
    ...screenshotPlaceholder("صفحة التقارير – خيارات تصدير بيانات المرضى والحالات"),
    sectionHeading("8.1 تقرير بيانات المرضى (CSV)", 2),
    rtlPara(
      "اضغط «تنزيل» في بطاقة «بيانات المرضى» للحصول على ملف CSV (يفتح مباشرةً في Excel) يحتوي على:"
    ),
    bullet("الاسم بالعربية والإنجليزية"),
    bullet("رقم الهوية الوطنية"),
    bullet("رقم الجوال، تاريخ الميلاد، العمر"),
    bullet("المركز الصحي والقطاع والمستشفى"),
    sectionHeading("8.2 تقرير حالات الحمل (CSV)", 2),
    rtlPara(
      "اضغط «تنزيل» في بطاقة «حالات الحمل» للحصول على ملف CSV يحتوي على:"
    ),
    bullet("بيانات المريضة المرتبطة"),
    bullet("تاريخ الزيارة، عمر الحمل، درجة الخطورة"),
    bullet("مستوى الالتزام، توصية الإحالة"),
    bullet("VTE، Enoxaparin، الأدوية"),
    bullet("المستشفى المُحوَّل إليه وتاريخ الموعد"),
    sectionHeading("8.3 تصدير المواعيد بخيارات تصفية مخصصة (CSV)", 2),
    rtlPara(
      "من صفحة المواعيد، طبّق الفلاتر المطلوبة ثم اضغط «تصدير CSV» لتنزيل المواعيد المعروضة فحسب:"
    ),
    infoTable([
      ["التصفية بالتاريخ", "اليوم / الأسبوع / نطاق زمني مخصص (من تاريخ – إلى تاريخ)"],
      ["التصفية بالقطاع", "اختر قطاعًا لتصدير مواعيد قطاع محدد"],
      ["التصفية بمستوى الخطورة", "صدّر الحالات الحرجة أو العالية فقط"],
      ["التصفية بالحالة", "مجدول / حضر / غائب / تحتاج متابعة"],
    ], "خيارات التصفية قبل تصدير المواعيد"),
    sectionHeading("8.4 تصدير ملف المريضة بصيغة PDF", 2),
    rtlPara(
      "لتصدير ملف مريضة أو حالة حمل بصيغة PDF، انتقل إلى تفاصيل الحالة واضغط «تصدير PDF». " +
      "يُنشئ النظام صفحة مُنسَّقة بالعربية تحتوي على كامل البيانات، ثم تفتح نافذة الطباعة تلقائيًا. " +
      "اختر «حفظ كـ PDF» أو «طباعة» حسب الحاجة."
    ),
    ...screenshotPlaceholder("نافذة تصدير PDF لملف مريضة – البيانات الكاملة"),
    sectionHeading("8.5 ملاحظات تقنية للتصدير", 2),
    noteBox(
      "ملفات CSV مُشفَّرة بـ UTF-8 مع BOM لضمان ظهور النص العربي بشكل صحيح في Excel. " +
      "عند فتح الملف في Excel اختر «استيراد بيانات» وحدد ترميز UTF-8 إذا طُلب منك ذلك.",
      "info"
    ),
    noteBox(
      "لحفظ PDF: افتح نافذة الطباعة (Ctrl+P أو ⌘+P) ← اختر «Microsoft Print to PDF» أو «حفظ كـ PDF» ← اضبط الحجم A4 واتجاه RTL ← «حفظ».",
      "tip"
    ),
    pageBreak()
  );

  // ============================================================
  // SECTION 9: REFERENCE DATA & USERS
  // ============================================================
  sections.push(
    sectionHeading("القسم التاسع: بيانات المراجع وإدارة المستخدمين", 1),
    sectionHeading("9.1 بيانات المراجع (للمدراء)", 2),
    rtlPara(
      "تُدار بيانات المراجع (المستشفيات، القطاعات، المراكز الصحية) من قِبَل مسؤولي المنظومة مباشرةً في قاعدة البيانات. " +
      "لإضافة مركز صحي جديد أو تعديل قطاع، تواصل مع فريق الدعم التقني."
    ),
    infoTable([
      ["المستشفيات", "6 مستشفيات رئيسية في المنطقة (انظر ملحق أ)"],
      ["القطاعات", "8 قطاعات تابعة للمستشفيات"],
      ["المراكز الصحية", "~165 مركزًا صحيًا موزعةً على القطاعات"],
    ]),
    sectionHeading("9.2 إدارة حسابات المستخدمين (للمدراء فقط)", 2),
    rtlPara(
      "يمكن للمسؤول (Admin) الوصول إلى صفحة «إدارة المستخدمين» من الشريط الجانبي."
    ),
    ...screenshotPlaceholder("صفحة إدارة المستخدمين – قائمة الحسابات مع الأدوار"),
    sectionHeading("9.2.1 إضافة مستخدم جديد", 3),
    bullet("اضغط «إضافة مستخدم» في أعلى الصفحة"),
    bullet("أدخِل اسم المستخدم وكلمة المرور"),
    bullet("أدخِل الاسم بالعربية (والإنجليزية اختياريًا)"),
    bullet("حدد الدور: مدير / منسق / طبيب / عارض"),
    bullet("اضغط «إنشاء الحساب»"),
    sectionHeading("9.2.2 إدارة الحسابات الموجودة", 3),
    bullet("تغيير الدور: اضغط أيقونة القلم بجانب المستخدم، اختر الدور الجديد، ثم «حفظ»"),
    bullet("إيقاف الحساب مؤقتًا: اضغط أيقونة ✓ الخضراء لتحويلها إلى ✗ (الحساب يصبح موقوفًا)"),
    bullet("تفعيل الحساب: اضغط أيقونة ✗ الحمراء لتعيد تفعيله"),
    noteBox("لا يمكن حذف حساب نهائيًا من الواجهة – الإيقاف هو الخيار الأنسب للحسابات غير الفعّالة.", "warning"),
    pageBreak()
  );

  // ============================================================
  // SECTION 10: MOBILE APP
  // ============================================================
  sections.push(
    sectionHeading("القسم العاشر: التطبيق المحمول", 1),
    rtlPara(
      "يتوفر تطبيق مرافق للهواتف الذكية يتيح للمنسقين متابعة المواعيد وإدارة الحالات أثناء التنقل. " +
      "التطبيق متاح على أنظمة Android وiOS."
    ),
    sectionHeading("10.1 تثبيت التطبيق", 2),
    infoTable([
      ["Android", "قم بتثبيت تطبيق Expo Go من متجر Google Play، ثم امسح رمز QR المُقدَّم من فريق الدعم"],
      ["iOS", "قم بتثبيت تطبيق Expo Go من App Store، ثم امسح رمز QR"],
      ["التثبيت المباشر", "سيوفر فريق الدعم ملف APK للتثبيت المباشر على Android"],
    ]),
    sectionHeading("10.2 تسجيل الدخول في التطبيق", 2),
    rtlPara(
      "تسجيل الدخول في التطبيق يستخدم نفس بيانات اعتماد المنظومة الإلكترونية (اسم المستخدم + كلمة المرور)."
    ),
    ...screenshotPlaceholder("شاشة تسجيل الدخول في التطبيق المحمول"),
    sectionHeading("10.3 الشاشات الرئيسية للتطبيق", 2),
    sectionHeading("10.3.1 لوحة المعلومات (Dashboard)", 3),
    rtlPara(
      "تعرض ملخصًا سريعًا للإحصاءات: إجمالي المرضى، الحالات الحرجة، نسبة الالتزام. " +
      "تظهر التنبيهات العاجلة في الأعلى بشريط برتقالي."
    ),
    ...screenshotPlaceholder("لوحة معلومات التطبيق المحمول"),
    sectionHeading("10.3.2 المواعيد في التطبيق", 3),
    rtlPara(
      "تعرض شاشة المواعيد جميع المواعيد مع خيارات التصفية الأساسية. " +
      "يمكن الضغط على أي موعد لعرض تفاصيله وتسجيل الحضور."
    ),
    ...screenshotPlaceholder("شاشة المواعيد في التطبيق المحمول"),
    sectionHeading("10.3.3 حجز موعد من التطبيق", 3),
    bullet("افتح ملف المريضة أو الحالة"),
    bullet("اضغط «حجز موعد جديد»"),
    bullet("حدد المستشفى وتاريخ الموعد"),
    bullet("اضغط «حفظ» – يُزامَن الموعد فورًا مع المنظومة الإلكترونية"),
    sectionHeading("10.4 التنبيه العاجل في التطبيق", 2),
    rtlPara(
      "عند وجود مواعيد منقضية تحتاج متابعة، يظهر شريط تنبيه برتقالي في أعلى التطبيق. " +
      "الضغط عليه ينقلك مباشرةً لقائمة المواعيد التي تحتاج إجراءً."
    ),
    pageBreak()
  );

  // ============================================================
  // APPENDIX A: HOSPITALS & SECTORS
  // ============================================================
  sections.push(
    sectionHeading("ملحق أ: جدول المستشفيات والقطاعات الثمانية", 1),
    rtlPara(
      "يضم تجمع جازان الصحي 8 قطاعات مرتبطة بـ 6 مستشفيات رئيسية، تشرف على 184 مركزًا صحيًا. " +
      "الجدول أدناه يوضح توزيع القطاعات على المستشفيات مع عدد المراكز الصحية لكل قطاع.",
      { spacing: { before: 80, after: 120 } }
    ),
    // Full hospital-sector table with real data from live API
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        // Header row
        new TableRow({
          tableHeader: true,
          children: [
            new TableCell({
              shading: { type: ShadingType.SOLID, color: GREEN_MID, fill: GREEN_MID },
              children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "رقم القطاع", bold: true, size: 20, color: WHITE, font: "Calibri" })] })],
            }),
            new TableCell({
              shading: { type: ShadingType.SOLID, color: GREEN_MID, fill: GREEN_MID },
              children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "اسم القطاع", bold: true, size: 20, color: WHITE, font: "Calibri" })] })],
            }),
            new TableCell({
              shading: { type: ShadingType.SOLID, color: GREEN_MID, fill: GREEN_MID },
              children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "المستشفى المرجعي", bold: true, size: 20, color: WHITE, font: "Calibri" })] })],
            }),
            new TableCell({
              shading: { type: ShadingType.SOLID, color: GREEN_MID, fill: GREEN_MID },
              children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "عدد المراكز الصحية", bold: true, size: 20, color: WHITE, font: "Calibri" })] })],
            }),
          ],
        }),
        // Data rows - real data from live API
        ...[
          ["1", "المركزي", "مستشفى جازان العام", "23"],
          ["2", "الغربي", "مستشفى صبيا العام", "30"],
          ["3", "الأوسط", "مستشفى أبو عريش العام", "33"],
          ["4", "الجنوبي", "مستشفى صامطة العام", "43"],
          ["5", "الشمالي", "مستشفى بيش العام", "25"],
          ["6", "الجبلي", "مستشفى صبيا العام", "13"],
          ["7", "بني مالك", "مستشفى أبو عريش العام", "13"],
          ["8", "فرسان", "مستشفى جازان العام", "4"],
        ].map(([num, sector, hospital, count], i) =>
          new TableRow({
            children: [num, sector, hospital, count].map((cell) =>
              new TableCell({
                shading: i % 2 === 0
                  ? { type: ShadingType.SOLID, color: GREEN_LIGHT, fill: GREEN_LIGHT }
                  : undefined,
                borders: {
                  top: { style: BorderStyle.SINGLE, color: "E5E7EB", size: 2 },
                  bottom: { style: BorderStyle.SINGLE, color: "E5E7EB", size: 2 },
                  left: { style: BorderStyle.SINGLE, color: "E5E7EB", size: 2 },
                  right: { style: BorderStyle.SINGLE, color: "E5E7EB", size: 2 },
                },
                children: [new Paragraph({
                  bidirectional: true,
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: cell, size: 20, color: GRAY_DARK, font: "Calibri" })],
                })],
              })
            ),
          })
        ),
        // Totals row
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 2,
              shading: { type: ShadingType.SOLID, color: GREEN_LIGHT, fill: GREEN_LIGHT },
              children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "الإجمالي (8 قطاعات)", bold: true, size: 20, color: GREEN_MID, font: "Calibri" })] })],
            }),
            new TableCell({
              shading: { type: ShadingType.SOLID, color: GREEN_LIGHT, fill: GREEN_LIGHT },
              children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "6 مستشفيات", bold: true, size: 20, color: GREEN_MID, font: "Calibri" })] })],
            }),
            new TableCell({
              shading: { type: ShadingType.SOLID, color: GREEN_LIGHT, fill: GREEN_LIGHT },
              children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "184 مركزاً", bold: true, size: 20, color: GREEN_MID, font: "Calibri" })] })],
            }),
          ],
        }),
      ],
    }),
    sectionHeading("أ.1 المستشفيات الستة في تجمع جازان الصحي", 2),
    infoTable([
      ["1", "مستشفى جازان العام – يخدم قطاعَي المركزي وفرسان"],
      ["2", "مستشفى صبيا العام – يخدم قطاعَي الغربي والجبلي"],
      ["3", "مستشفى أبو عريش العام – يخدم قطاعَي الأوسط وبني مالك"],
      ["4", "مستشفى صامطة العام – يخدم القطاع الجنوبي"],
      ["5", "مستشفى بيش العام – يخدم القطاع الشمالي"],
      ["6", "مستشفى الملك فهد المركزي (KFCH) – مستشفى تخصصي يستقبل تحويلات الحالات الحرجة من جميع القطاعات"],
    ]),
    pageBreak()
  );

  // ============================================================
  // APPENDIX B: RISK LEVEL DEFINITIONS
  // ============================================================
  sections.push(
    sectionHeading("ملحق ب: تعريفات مستويات الخطورة", 1),
    infoTable([
      ["منخفض (Low)", "لا توجد عوامل خطر أو عامل واحد طفيف – متابعة روتينية في المركز الصحي – اللون: أخضر"],
      ["متوسط (Medium)", "عامل أو عاملان من المجموعة الأولى – متابعة مكثفة – اللون: أصفر"],
      ["عالٍ (High)", "عوامل خطر متعددة أو حالة مزمنة مُؤثِّرة – إحالة للمستشفى – اللون: برتقالي"],
      ["حرج (Critical)", "حالة طارئة أو مضاعفة شديدة – إحالة فورية لـ KFCH أو أقرب مستشفى مجهَّز – اللون: أحمر غامق"],
    ], "تعريفات مستويات الخطورة الأربعة"),
    sectionHeading("ب.1 بروتوكول مستوى VTE", 2),
    rtlPara(
      "عند تحديد «VTE عالي الخطورة» يجب وصف Enoxaparin (إنوكساباريين) للمريضة. " +
      "إذا لم يُوصَف الدواء، تُولِّد المنظومة تنبيهًا فوريًا في صفحة التنبيهات."
    ),
    pageBreak()
  );

  // ============================================================
  // APPENDIX C: COMPLIANCE CALCULATION
  // ============================================================
  sections.push(
    sectionHeading("ملحق ج: حساب أيام الالتزام", 1),
    rtlPara(
      "تحسب المنظومة الفرق بين تاريخ الزيارة السريرية وتاريخ الموعد المحجوز في المستشفى، " +
      "مع استثناء أيام الجمعة والسبت (عطلة نهاية الأسبوع الرسمية في المملكة العربية السعودية)."
    ),
    sectionHeading("ج.1 قاعدة الحساب", 2),
    infoTable([
      ["أيام العمل", "الأحد، الاثنين، الثلاثاء، الأربعاء، الخميس"],
      ["أيام العطلة (مستثناة)", "الجمعة والسبت"],
      ["حد الالتزام", "≤ 2 يوم عمل من تاريخ الزيارة"],
    ]),
    sectionHeading("ج.2 أمثلة تطبيقية", 2),
    infoTable([
      ["زيارة الأحد + موعد الاثنين", "1 يوم عمل → ملتزم ✅"],
      ["زيارة الأحد + موعد الثلاثاء", "2 يوم عمل → ملتزم ✅"],
      ["زيارة الأحد + موعد الأربعاء", "3 أيام عمل → غير ملتزم ❌"],
      ["زيارة الخميس + موعد الأحد التالي", "1 يوم عمل (الجمعة والسبت مستثنيان) → ملتزم ✅"],
      ["لا يوجد موعد محجوز", "بانتظار موعد ⏳"],
    ], "أمثلة على حساب الالتزام"),
    pageBreak()
  );

  // ============================================================
  // APPENDIX D: FAQ
  // ============================================================
  sections.push(
    sectionHeading("ملحق د: الأسئلة الشائعة", 1),
    ...[
      [
        "لماذا لا تظهر المريضة في نتائج البحث؟",
        "تأكد من إدخال رقم الهوية الوطنية كاملًا (10 أرقام). إذا لم تُسجَّل بعد، اضغط «تسجيل مريضة جديدة».",
      ],
      [
        "هل يمكن للمريضة أن يكون لها أكثر من حالة حمل؟",
        "نعم، يمكن إضافة حالات حمل متعددة لنفس المريضة عبر ملفها الشخصي.",
      ],
      [
        "كيف أُعدِّل بيانات حالة حمل بعد حفظها؟",
        "افتح تفاصيل الحالة، ثم اضغط «تعديل الحالة» لتفعيل وضع التعديل. عدّل ما تريد ثم اضغط «حفظ».",
      ],
      [
        "ما الفرق بين تسجيل موعد في نموذج الحمل وإضافة موعد مستقل؟",
        "الموعد في نموذج الحمل هو الموعد الأولي المرتبط بالزيارة السريرية ويحسب الالتزام. المواعيد المستقلة تُضاف من صفحة تفاصيل الحالة وتُسجَّل في سجل المواعيد.",
      ],
      [
        "لماذا تظهر تنبيهات VTE على حالة بدون إنوكساباريين؟",
        "لأن الحالة مصنفة كـ VTE عالي الخطورة دون وصف الدواء المناسب. راجع الحالة مع الطبيب المسؤول.",
      ],
      [
        "هل تُحذَف التنبيهات تلقائيًا؟",
        "نعم، عند معالجة سبب التنبيه (وصف الدواء، حجز موعد، تسجيل حضور) يختفي التنبيه عند تحديث الصفحة.",
      ],
      [
        "كيف أُغيِّر لغة الواجهة؟",
        "اضغط على أيقونة اللغة (عربي/English) في أعلى الشريط الجانبي. يُحفَظ الاختيار تلقائيًا.",
      ],
      [
        "ماذا أفعل إذا نسيت كلمة المرور؟",
        "تواصل مع مسؤول المنظومة (Admin) لإعادة تعيين كلمة المرور. لا توجد خاصية «نسيت كلمة المرور» ذاتية حاليًا.",
      ],
      [
        "هل يمكن تصدير بيانات قطاع محدد فقط؟",
        "في صفحة المواعيد يمكن التصفية بالقطاع ثم التصدير. في صفحة التقارير يتم تصدير جميع البيانات حاليًا.",
      ],
      [
        "كيف أتواصل مع الدعم التقني؟",
        "عبر البريد الإلكتروني: his@jazan-health.gov.sa أو الهاتف الداخلي في ساعات الدوام (الأحد – الخميس).",
      ],
    ].flatMap(([q, a]) => [
      rtlPara(`س: ${q}`, { bold: true, color: GREEN_MID, spacing: { before: 160, after: 40 } }),
      rtlPara(`ج: ${a}`, { spacing: { before: 40, after: 80 }, indent: { start: convertInchesToTwip(0.3) } }),
    ])
  );

  // ── Build final document ──────────────────────────────────────────────────
  const doc = new Document({
    creator: "تجمع جازان الصحي",
    title: "دليل المستخدم – منظومة تتبع الحمل عالي الخطورة",
    description: "الدليل الشامل للمنظومة الإلكترونية لتتبع الحمل عالي الخطورة في تجمع جازان الصحي 2026",
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 24,
            color: GRAY_DARK,
          },
          paragraph: {
            spacing: { line: 360 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1.25),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.RIGHT,
                border: {
                  bottom: {
                    color: GREEN_MID,
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 4,
                  },
                },
                children: [
                  new TextRun({
                    text: "منظومة تتبع الحمل عالي الخطورة – تجمع جازان الصحي 2026",
                    size: 18,
                    color: GREEN_MID,
                    font: "Calibri",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.CENTER,
                border: {
                  top: {
                    color: "E5E7EB",
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 4,
                  },
                },
                children: [
                  new TextRun({
                    text: "صفحة ",
                    size: 18,
                    color: GRAY_MID,
                    font: "Calibri",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    color: GRAY_MID,
                    font: "Calibri",
                  }),
                  new TextRun({
                    text: " من ",
                    size: 18,
                    color: GRAY_MID,
                    font: "Calibri",
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 18,
                    color: GRAY_MID,
                    font: "Calibri",
                  }),
                  new TextRun({
                    text: "  |  دليل المستخدم – الإصدار 1.0 – مايو 2026",
                    size: 18,
                    color: GRAY_MID,
                    font: "Calibri",
                  }),
                ],
              }),
            ],
          }),
        },
        children: sections,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log("📄 جاري إنشاء دليل المستخدم...");
  const buffer = await buildDocument();
  fs.writeFileSync(OUTPUT_PATH, buffer);
  const sizeKB = Math.round(buffer.length / 1024);
  console.log(`✅ تم إنشاء الملف بنجاح: ${OUTPUT_PATH}`);
  console.log(`   الحجم: ${sizeKB} كيلوبايت`);
})();
