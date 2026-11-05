/**
 * Textos en inglés de datos que en la BD solo existen en español (descripción
 * de producto, historia de finca, proceso y tueste). Lo que no esté aquí no se
 * muestra en el sitio en inglés: mejor sin texto que un párrafo en español.
 */
export const PRODUCT_DESCRIPTION_EN: Record<string, string> = {
  "cf-isnos-geisha":
    "Geisha from Finca Rengifo, grown at 1,620 m in Isnos, Huila, by Jaime Morales. Washed with a 40-hour anaerobic fermentation and a medium roast. Whole bean, 250 g.",
  "cf-pitalito-sidra":
    "Sidra from Finca Rengifo, grown at 1,700 m in Pitalito, Huila, by Fabián Muñoz. Washed with a 40-hour anaerobic fermentation and a medium roast. Whole bean, 250 g.",
  "cac-mesa":
    "Organic drinking chocolate tablets with 70% cacao. Melt one into hot milk or water, the way it's done at home in Colombia. More cacao per serving, so a bar goes a long way.",
  "cac-barra": "Solid cacao bars. Plenty of energy and nothing added to hide behind.",
  "cac-grano": "Cacao molded into the shape of a coffee bean. Good next to a cup of coffee or on top of a dessert.",
  "cac-polvo": "100% cacao powder for baking and pastry. Also quick to stir into something hot or cold.",
  "cac-manteca": "Cold-pressed cacao butter, made for chocolate makers and home bakers.",
};

export const FARM_STORY_EN: Record<string, string> = {
  "finca-el-paraiso":
    "High above Pitalito, the Pérez family has grown coffee for three generations. Don Juan inherited Finca El Paraíso from his father and turned it into a reference for specialty coffee in Huila.\nAt 1,800 meters, Geisha and Caturra trees ripen slowly under native shade trees. Every harvest is picked by hand, keeping only the cherries at their peak.\nOrganic practices and fair trade shape how the farm works, both with the land and with the people on it.",
  "finca-la-esperanza":
    "Finca La Esperanza started with Rosa Martínez wanting to show that La Unión, Nariño, produces some of the best coffee in the world.\nAt 2,100 meters, the cold mountain climate makes the bean develop slowly, concentrating sugars and acidity. The farm grows Castillo and Caturra, with honey processes that bring out their natural sweetness.\nWith Rainforest Alliance certification, the farm protects the ecosystem around every coffee plot.",
  "finca-sierra-azul":
    "On the slopes of the Sierra Nevada de Santa Marta, Finca Sierra Azul joins the ancestral heritage of the territory with the care of Luis Sánchez and his family.\nThe nearby sea and the altitude of the sierra create a microclimate where Typica and Bourbon develop a heavy body.\nFor two decades the farm has worked with organic practices, respecting natural cycles and the communities who live there.",
};

const PROCESS: Record<string, string> = { Lavado: "Washed", Honey: "Honey", Natural: "Natural" };
const ROAST: Record<string, string> = { Claro: "Light", Medio: "Medium", Oscuro: "Dark" };
const CATEGORY: Record<string, string> = { cafe: "Coffee", accesorio: "Accessories", merchandising: "Merch", cacao: "Cacao" };

export const processEn = (v?: string | null) => (v ? PROCESS[v] ?? v : null);
export const roastEn = (v?: string | null) => (v ? ROAST[v] ?? v : null);
export const categoryEn = (v?: string | null) => (v ? CATEGORY[v] ?? v : "");
