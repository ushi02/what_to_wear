import type { Item } from '../types'

type BaseItem = Omit<Item, 'owned' | 'wishlist'>

/** 懒人版 unisex 基础衣橱。新用户默认全部"已拥有"，没有的自己划掉。name 只是给开发看的，界面上走 i18n。 */
export const BASE_WARDROBE: BaseItem[] = [
  // 上衣（贴身那层，按白天最高体感选）
  { id: 'tee-white', name: '白色短袖 T 恤', emoji: '👕', category: 'top', range: [20, 45] },
  { id: 'tee-black', name: '黑色短袖 T 恤', emoji: '👕', category: 'top', range: [20, 45], dark: true },
  { id: 'shirt', name: '衬衫', emoji: '👔', category: 'top', range: [15, 28] },
  { id: 'longsleeve', name: '长袖打底 T', emoji: '👚', category: 'top', range: [6, 24] },
  { id: 'thermal', name: '保暖内衣', emoji: '🌡️', category: 'top', range: [-30, 7] },

  // 中间层
  { id: 'knit-light', name: '薄针织衫', emoji: '🧶', category: 'mid', range: [10, 20] },
  { id: 'hoodie', name: '卫衣', emoji: '🧥', category: 'mid', range: [6, 18] },
  { id: 'sweater', name: '厚毛衣', emoji: '🧶', category: 'mid', range: [-30, 8] },

  // 外套（按早晚最低体感选）
  { id: 'windbreaker', name: '防风防泼水夹克', emoji: '🌬️', category: 'outer', range: [9, 22], windproof: true },
  { id: 'light-down', name: '薄羽绒 / 棉服', emoji: '🧥', category: 'outer', range: [1, 12] },
  { id: 'heavy-down', name: '厚羽绒服', emoji: '🧥', category: 'outer', range: [-30, 3], windproof: true },

  // 下装
  { id: 'shorts', name: '短裤', emoji: '🩳', category: 'bottom', range: [25, 45] },
  { id: 'chinos', name: '休闲长裤', emoji: '👖', category: 'bottom', range: [8, 30] },
  { id: 'jeans', name: '牛仔裤', emoji: '👖', category: 'bottom', range: [2, 26] },
  { id: 'fleece-pants', name: '加绒长裤', emoji: '👖', category: 'bottom', range: [-30, 6] },

  // 鞋
  { id: 'canvas', name: '帆布鞋（匡威）', emoji: '👟', category: 'shoes', range: [6, 32], rain: 1 },
  { id: 'sneaker-white', name: '白色板鞋', emoji: '👟', category: 'shoes', range: [4, 32], rain: 1 },
  { id: 'sneaker-mesh', name: '网面运动鞋', emoji: '👟', category: 'shoes', range: [4, 35], rain: 0 },
  { id: 'leather', name: '皮鞋 / 乐福鞋', emoji: '👞', category: 'shoes', range: [-5, 30], rain: 2 },
  { id: 'boots', name: '防水短靴 / 雨靴', emoji: '🥾', category: 'shoes', range: [-30, 22], rain: 3 },
  { id: 'sandals', name: '凉鞋 / 拖鞋', emoji: '🩴', category: 'shoes', range: [27, 45], rain: 1 },

  // 配件
  { id: 'umbrella', name: '折叠伞', emoji: '☂️', category: 'accessory', range: [-30, 45], need: 'rain' },
  { id: 'cap', name: '棒球帽', emoji: '🧢', category: 'accessory', range: [-30, 45], need: 'uv' },
  { id: 'sunglasses', name: '墨镜', emoji: '🕶️', category: 'accessory', range: [-30, 45], need: 'uv' },
  { id: 'scarf', name: '围巾', emoji: '🧣', category: 'accessory', range: [-30, 45], need: 'cold' },
  { id: 'gloves', name: '手套', emoji: '🧤', category: 'accessory', range: [-30, 45], need: 'freezing' },
]

export function freshWardrobe(): Item[] {
  return BASE_WARDROBE.map((i) => ({ ...i, owned: true, wishlist: false }))
}
