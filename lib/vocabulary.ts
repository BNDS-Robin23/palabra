export type VocabularyCategory = {
  id: string;
  zh: string;
  es: string;
  words: Array<[word: string, zh: string]>;
};

export const VOCABULARY_CATEGORIES: VocabularyCategory[] = [
  {
    id: "tiempo-fechas", zh: "时间与日期", es: "Tiempo y fechas", words: [
      ["tiempo", "时间"], ["fecha", "日期"], ["día", "天；日"], ["semana", "星期；周"],
      ["mes", "月"], ["año", "年"], ["hora", "小时；时间点"], ["minuto", "分钟"],
      ["segundo", "秒"], ["mañana", "早晨"], ["tarde", "下午；傍晚"], ["noche", "夜晚"],
      ["lunes", "星期一"], ["martes", "星期二"], ["miércoles", "星期三"], ["jueves", "星期四"],
      ["viernes", "星期五"], ["sábado", "星期六"], ["domingo", "星期日"], ["calendario", "日历"],
    ],
  },
  {
    id: "cuerpo", zh: "身体部位", es: "Partes del cuerpo", words: [
      ["cabeza", "头"], ["cara", "脸"], ["ojo", "眼睛"], ["nariz", "鼻子"], ["boca", "嘴"],
      ["oreja", "耳朵"], ["cuello", "脖子"], ["hombro", "肩膀"], ["brazo", "手臂"], ["mano", "手"],
      ["dedo", "手指；脚趾"], ["pecho", "胸部"], ["espalda", "背部"], ["estómago", "胃；腹部"],
      ["pierna", "腿"], ["rodilla", "膝盖"], ["pie", "脚"], ["pelo", "头发"], ["diente", "牙齿"],
      ["garganta", "喉咙"],
    ],
  },
  {
    id: "aspecto", zh: "外貌", es: "Aspecto físico", words: [
      ["aspecto", "外貌"], ["altura", "身高"], ["peso", "体重"], ["estatura", "身材；身高"],
      ["pelo", "头发"], ["cabello", "头发"], ["barba", "胡须"], ["bigote", "小胡子"], ["piel", "皮肤"],
      ["rostro", "面孔"], ["cara", "脸"], ["ojo", "眼睛"], ["nariz", "鼻子"], ["boca", "嘴"],
      ["labio", "嘴唇"], ["ceja", "眉毛"], ["pestaña", "睫毛"], ["arruga", "皱纹"],
      ["peinado", "发型"], ["apariencia", "外表"],
    ],
  },
  {
    id: "caracter-emociones", zh: "性格与情绪", es: "Carácter y sentimientos", words: [
      ["carácter", "性格"], ["personalidad", "个性"], ["sentimiento", "感情"], ["emoción", "情绪"],
      ["alegría", "快乐"], ["tristeza", "悲伤"], ["miedo", "恐惧"], ["amor", "爱"], ["odio", "恨"],
      ["sorpresa", "惊讶"], ["vergüenza", "羞耻；害羞"], ["orgullo", "自豪"], ["paciencia", "耐心"],
      ["humor", "心情；幽默"], ["preocupación", "担忧"], ["nervios", "紧张"], ["felicidad", "幸福"],
      ["confianza", "信任；自信"], ["esperanza", "希望"], ["enfado", "生气"],
    ],
  },
  {
    id: "familia", zh: "家庭与人际关系", es: "Familia y relaciones", words: [
      ["familia", "家庭"], ["padre", "父亲"], ["madre", "母亲"], ["hijo", "儿子"], ["hija", "女儿"],
      ["hermano", "兄弟"], ["hermana", "姐妹"], ["abuelo", "祖父；外祖父"], ["abuela", "祖母；外祖母"],
      ["tío", "叔叔；舅舅等"], ["tía", "阿姨；姑姑等"], ["primo", "堂/表兄弟"],
      ["prima", "堂/表姐妹"], ["marido", "丈夫"], ["mujer", "妻子；女人"], ["pareja", "伴侣"],
      ["amigo", "朋友"], ["compañero", "同伴；同事"], ["vecino", "邻居"], ["relación", "关系"],
    ],
  },
  {
    id: "alimentos", zh: "食物", es: "Alimentos", words: [
      ["pan", "面包"], ["arroz", "米；米饭"], ["carne", "肉"], ["pescado", "鱼；鱼肉"],
      ["pollo", "鸡；鸡肉"], ["huevo", "鸡蛋"], ["queso", "奶酪"], ["leche", "牛奶"],
      ["fruta", "水果"], ["verdura", "蔬菜"], ["tomate", "西红柿"], ["patata", "土豆"],
      ["cebolla", "洋葱"], ["manzana", "苹果"], ["naranja", "橙子"], ["plátano", "香蕉"],
      ["uva", "葡萄"], ["ensalada", "沙拉"], ["sopa", "汤"], ["postre", "甜点"],
    ],
  },
  {
    id: "bebidas-comidas", zh: "饮料与餐饮", es: "Bebidas y comidas", words: [
      ["agua", "水"], ["café", "咖啡"], ["té", "茶"], ["leche", "牛奶"], ["zumo", "果汁"],
      ["refresco", "汽水；软饮"], ["bebida", "饮料"], ["desayuno", "早餐"], ["almuerzo", "午餐；简餐"],
      ["comida", "饭；正餐"], ["merienda", "下午茶；加餐"], ["cena", "晚餐"], ["restaurante", "餐厅"],
      ["bar", "酒吧；小餐馆"], ["menú", "菜单；套餐"], ["plato", "菜肴；盘子"], ["cuenta", "账单"],
      ["camarero", "服务员"], ["mesa", "桌子"], ["reserva", "预订"],
    ],
  },
  {
    id: "ropa", zh: "衣物与鞋子", es: "Ropa y calzado", words: [
      ["ropa", "衣服"], ["camisa", "衬衫"], ["camiseta", "T恤"], ["pantalón", "裤子"],
      ["vaqueros", "牛仔裤"], ["falda", "裙子"], ["vestido", "连衣裙"], ["jersey", "毛衣"],
      ["abrigo", "大衣"], ["chaqueta", "夹克"], ["traje", "西装；套装"], ["pijama", "睡衣"],
      ["zapato", "鞋"], ["bota", "靴子"], ["zapatilla", "运动鞋；拖鞋"], ["calcetín", "袜子"],
      ["sombrero", "帽子"], ["gorra", "鸭舌帽"], ["guante", "手套"], ["bufanda", "围巾"],
    ],
  },
  {
    id: "vivienda", zh: "住房与家具", es: "Vivienda y muebles", words: [
      ["casa", "房子；家"], ["piso", "公寓；楼层"], ["habitación", "房间"], ["dormitorio", "卧室"],
      ["salón", "客厅"], ["cocina", "厨房"], ["baño", "浴室"], ["terraza", "露台"], ["balcón", "阳台"],
      ["puerta", "门"], ["ventana", "窗户"], ["mesa", "桌子"], ["silla", "椅子"], ["cama", "床"],
      ["sofá", "沙发"], ["armario", "衣柜"], ["estantería", "架子；书架"], ["lámpara", "灯"],
      ["nevera", "冰箱"], ["alquiler", "租金；租赁"],
    ],
  },
  {
    id: "transporte", zh: "交通", es: "Transporte", words: [
      ["coche", "汽车"], ["autobús", "公交车"], ["metro", "地铁"], ["tren", "火车"], ["taxi", "出租车"],
      ["bicicleta", "自行车"], ["moto", "摩托车"], ["avión", "飞机"], ["barco", "船"],
      ["tranvía", "有轨电车"], ["estación", "车站"], ["parada", "站点"], ["aeropuerto", "机场"],
      ["billete", "票"], ["andén", "站台"], ["carretera", "公路"], ["autopista", "高速公路"],
      ["semáforo", "红绿灯"], ["atasco", "堵车"], ["tráfico", "交通"],
    ],
  },
  {
    id: "viajes", zh: "旅行与住宿", es: "Viajes y alojamiento", words: [
      ["viaje", "旅行"], ["vacaciones", "假期"], ["turismo", "旅游"], ["turista", "游客"],
      ["destino", "目的地"], ["hotel", "酒店"], ["hostal", "旅馆"], ["alojamiento", "住宿"],
      ["habitación", "房间"], ["reserva", "预订"], ["recepción", "前台"], ["pasaporte", "护照"],
      ["visado", "签证"], ["maleta", "行李箱"], ["equipaje", "行李"], ["mapa", "地图"],
      ["guía", "导游；指南"], ["excursión", "短途旅行"], ["playa", "海滩"], ["camping", "露营；露营地"],
    ],
  },
  {
    id: "compras", zh: "购物与金钱", es: "Compras y dinero", words: [
      ["tienda", "商店"], ["mercado", "市场"], ["supermercado", "超市"], ["producto", "商品"],
      ["precio", "价格"], ["oferta", "优惠；特价"], ["descuento", "折扣"], ["dinero", "钱"],
      ["euro", "欧元"], ["moneda", "硬币；货币"], ["billete", "纸币"], ["tarjeta", "卡"],
      ["efectivo", "现金"], ["caja", "收银台"], ["ticket", "小票"], ["factura", "发票；账单"],
      ["compra", "购买；购物"], ["venta", "销售"], ["cliente", "顾客"], ["vendedor", "售货员"],
    ],
  },
  {
    id: "trabajo", zh: "工作与职业", es: "Trabajo y profesiones", words: [
      ["trabajo", "工作"], ["empleo", "工作；职位"], ["profesión", "职业"], ["empresa", "公司"],
      ["oficina", "办公室"], ["jefe", "老板；上司"], ["compañero", "同事"], ["empleado", "雇员"],
      ["médico", "医生"], ["profesor", "教师"], ["ingeniero", "工程师"], ["abogado", "律师"],
      ["camarero", "服务员"], ["cocinero", "厨师"], ["periodista", "记者"], ["policía", "警察"],
      ["secretario", "秘书"], ["director", "主管；经理"], ["salario", "工资"], ["reunión", "会议"],
    ],
  },
  {
    id: "educacion", zh: "学校与教育", es: "Educación", words: [
      ["escuela", "学校"], ["colegio", "学校"], ["instituto", "中学；学院"], ["universidad", "大学"],
      ["clase", "课；班级"], ["curso", "课程"], ["profesor", "老师"], ["alumno", "学生"],
      ["estudiante", "学生"], ["examen", "考试"], ["nota", "成绩；笔记"], ["libro", "书"],
      ["cuaderno", "笔记本"], ["diccionario", "词典"], ["bolígrafo", "圆珠笔"], ["lápiz", "铅笔"],
      ["pizarra", "黑板；白板"], ["biblioteca", "图书馆"], ["asignatura", "科目"], ["título", "学位；证书"],
    ],
  },
  {
    id: "salud", zh: "健康与卫生", es: "Salud e higiene", words: [
      ["salud", "健康"], ["médico", "医生"], ["hospital", "医院"], ["farmacia", "药店"],
      ["medicina", "药；医学"], ["enfermedad", "疾病"], ["dolor", "疼痛"], ["fiebre", "发烧"],
      ["tos", "咳嗽"], ["resfriado", "感冒"], ["herida", "伤口"], ["cita", "预约"], ["seguro", "保险"],
      ["ducha", "淋浴"], ["baño", "洗澡；浴室"], ["jabón", "肥皂"], ["champú", "洗发水"],
      ["cepillo", "刷子"], ["pasta de dientes", "牙膏"], ["toalla", "毛巾"],
    ],
  },
  {
    id: "ocio", zh: "休闲与运动", es: "Ocio y deporte", words: [
      ["ocio", "休闲"], ["deporte", "运动"], ["fútbol", "足球"], ["tenis", "网球"],
      ["baloncesto", "篮球"], ["natación", "游泳"], ["ciclismo", "骑行"], ["gimnasio", "健身房"],
      ["partido", "比赛"], ["equipo", "队伍"], ["jugador", "球员"], ["pelota", "球"], ["música", "音乐"],
      ["película", "电影"], ["cine", "电影；电影院"], ["teatro", "戏剧；剧院"], ["concierto", "音乐会"],
      ["libro", "书"], ["juego", "游戏"], ["fiesta", "聚会；节日"],
    ],
  },
  {
    id: "ciudad", zh: "城市与公共场所", es: "Ciudad y lugares públicos", words: [
      ["ciudad", "城市"], ["calle", "街道"], ["plaza", "广场"], ["barrio", "街区"], ["parque", "公园"],
      ["banco", "银行"], ["hospital", "医院"], ["farmacia", "药店"], ["supermercado", "超市"],
      ["mercado", "市场"], ["restaurante", "餐厅"], ["cafetería", "咖啡馆"], ["estación", "车站"],
      ["aeropuerto", "机场"], ["biblioteca", "图书馆"], ["museo", "博物馆"],
    ],
  },
];

export const VOCABULARY_CATEGORY_NAMES = Object.fromEntries(
  VOCABULARY_CATEGORIES.map((category) => [category.id, category.zh]),
) as Record<string, string>;
