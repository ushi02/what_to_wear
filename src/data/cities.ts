/** 内置热门城市：Open-Meteo 对中日文别名收录不全（比如搜"纽约""大阪"没结果），先查这张表。 */
export interface City {
  id: string
  en: string
  zh: string
  ja: string
  /** 其他常见写法，只用于搜索 */
  alt?: string[]
  cc: string
  lat: number
  lon: number
}

type Row = [id: string, en: string, zh: string, ja: string, cc: string, lat: number, lon: number, alt?: string[]]

const ROWS: Row[] = [
  // 中国
  ['beijing', 'Beijing', '北京', '北京', 'CN', 39.9, 116.41, ['Peking']],
  ['shanghai', 'Shanghai', '上海', '上海', 'CN', 31.23, 121.47],
  ['guangzhou', 'Guangzhou', '广州', '広州', 'CN', 23.13, 113.26, ['廣州', 'Canton']],
  ['shenzhen', 'Shenzhen', '深圳', '深セン', 'CN', 22.54, 114.06, ['深圳']],
  ['hangzhou', 'Hangzhou', '杭州', '杭州', 'CN', 30.27, 120.16],
  ['chengdu', 'Chengdu', '成都', '成都', 'CN', 30.57, 104.07],
  ['chongqing', 'Chongqing', '重庆', '重慶', 'CN', 29.56, 106.55],
  ['wuhan', 'Wuhan', '武汉', '武漢', 'CN', 30.59, 114.31],
  ['xian', "Xi'an", '西安', '西安', 'CN', 34.34, 108.94, ['Xian']],
  ['nanjing', 'Nanjing', '南京', '南京', 'CN', 32.06, 118.8],
  ['suzhou', 'Suzhou', '苏州', '蘇州', 'CN', 31.3, 120.58],
  ['tianjin', 'Tianjin', '天津', '天津', 'CN', 39.34, 117.36],
  ['xiamen', 'Xiamen', '厦门', 'アモイ', 'CN', 24.48, 118.09, ['廈門']],
  ['qingdao', 'Qingdao', '青岛', '青島', 'CN', 36.07, 120.38],
  ['changsha', 'Changsha', '长沙', '長沙', 'CN', 28.23, 112.94],
  ['kunming', 'Kunming', '昆明', '昆明', 'CN', 25.04, 102.71],
  ['harbin', 'Harbin', '哈尔滨', 'ハルビン', 'CN', 45.8, 126.53, ['哈爾濱']],
  ['shenyang', 'Shenyang', '沈阳', '瀋陽', 'CN', 41.81, 123.43],
  ['dalian', 'Dalian', '大连', '大連', 'CN', 38.91, 121.61],
  ['zhengzhou', 'Zhengzhou', '郑州', '鄭州', 'CN', 34.75, 113.63],
  ['hefei', 'Hefei', '合肥', '合肥', 'CN', 31.82, 117.23],
  ['fuzhou', 'Fuzhou', '福州', '福州', 'CN', 26.07, 119.3],
  ['jinan', 'Jinan', '济南', '済南', 'CN', 36.65, 117.12],
  ['sanya', 'Sanya', '三亚', '三亜', 'CN', 18.25, 109.51],
  ['lhasa', 'Lhasa', '拉萨', 'ラサ', 'CN', 29.65, 91.14],
  ['urumqi', 'Ürümqi', '乌鲁木齐', 'ウルムチ', 'CN', 43.83, 87.62, ['Urumqi']],
  ['hongkong', 'Hong Kong', '香港', '香港', 'HK', 22.32, 114.17],
  ['macau', 'Macau', '澳门', 'マカオ', 'MO', 22.2, 113.54, ['澳門', 'Macao']],
  ['taipei', 'Taipei', '台北', '台北', 'TW', 25.03, 121.57, ['臺北']],
  ['kaohsiung', 'Kaohsiung', '高雄', '高雄', 'TW', 22.63, 120.3],
  // 日本
  ['tokyo', 'Tokyo', '东京', '東京', 'JP', 35.68, 139.69, ['東京', 'とうきょう']],
  ['osaka', 'Osaka', '大阪', '大阪', 'JP', 34.69, 135.5, ['おおさか']],
  ['kyoto', 'Kyoto', '京都', '京都', 'JP', 35.01, 135.77, ['きょうと']],
  ['yokohama', 'Yokohama', '横滨', '横浜', 'JP', 35.44, 139.64, ['橫濱']],
  ['nagoya', 'Nagoya', '名古屋', '名古屋', 'JP', 35.18, 136.91],
  ['sapporo', 'Sapporo', '札幌', '札幌', 'JP', 43.06, 141.35],
  ['fukuoka', 'Fukuoka', '福冈', '福岡', 'JP', 33.59, 130.4],
  ['kobe', 'Kobe', '神户', '神戸', 'JP', 34.69, 135.2],
  ['sendai', 'Sendai', '仙台', '仙台', 'JP', 38.27, 140.87],
  ['hiroshima', 'Hiroshima', '广岛', '広島', 'JP', 34.39, 132.46],
  ['naha', 'Naha (Okinawa)', '那霸（冲绳）', '那覇（沖縄）', 'JP', 26.21, 127.68, ['冲绳', '沖縄', 'Okinawa']],
  ['nara', 'Nara', '奈良', '奈良', 'JP', 34.69, 135.8],
  ['kanazawa', 'Kanazawa', '金泽', '金沢', 'JP', 36.56, 136.66],
  // 韩国
  ['seoul', 'Seoul', '首尔', 'ソウル', 'KR', 37.57, 126.98, ['首爾', '서울', '汉城']],
  ['busan', 'Busan', '釜山', '釜山', 'KR', 35.18, 129.08, ['부산']],
  ['jeju', 'Jeju', '济州', '済州', 'KR', 33.5, 126.53, ['제주']],
  // 东南亚、南亚、中东
  ['singapore', 'Singapore', '新加坡', 'シンガポール', 'SG', 1.35, 103.82],
  ['bangkok', 'Bangkok', '曼谷', 'バンコク', 'TH', 13.76, 100.5],
  ['kualalumpur', 'Kuala Lumpur', '吉隆坡', 'クアラルンプール', 'MY', 3.14, 101.69],
  ['hanoi', 'Hanoi', '河内', 'ハノイ', 'VN', 21.03, 105.85],
  ['hochiminh', 'Ho Chi Minh City', '胡志明市', 'ホーチミン', 'VN', 10.82, 106.63, ['Saigon', '西贡']],
  ['manila', 'Manila', '马尼拉', 'マニラ', 'PH', 14.6, 120.98],
  ['jakarta', 'Jakarta', '雅加达', 'ジャカルタ', 'ID', -6.21, 106.85],
  ['bali', 'Bali (Denpasar)', '巴厘岛', 'バリ島', 'ID', -8.65, 115.22, ['Denpasar', '峇里']],
  ['delhi', 'New Delhi', '新德里', 'ニューデリー', 'IN', 28.61, 77.21, ['Delhi']],
  ['mumbai', 'Mumbai', '孟买', 'ムンバイ', 'IN', 19.08, 72.88],
  ['dubai', 'Dubai', '迪拜', 'ドバイ', 'AE', 25.2, 55.27],
  ['istanbul', 'Istanbul', '伊斯坦布尔', 'イスタンブール', 'TR', 41.01, 28.98],
  // 欧洲
  ['london', 'London', '伦敦', 'ロンドン', 'GB', 51.51, -0.13, ['倫敦']],
  ['manchester', 'Manchester', '曼彻斯特', 'マンチェスター', 'GB', 53.48, -2.24],
  ['edinburgh', 'Edinburgh', '爱丁堡', 'エディンバラ', 'GB', 55.95, -3.19],
  ['paris', 'Paris', '巴黎', 'パリ', 'FR', 48.86, 2.35],
  ['berlin', 'Berlin', '柏林', 'ベルリン', 'DE', 52.52, 13.4],
  ['munich', 'Munich', '慕尼黑', 'ミュンヘン', 'DE', 48.14, 11.58, ['München']],
  ['frankfurt', 'Frankfurt', '法兰克福', 'フランクフルト', 'DE', 50.11, 8.68],
  ['amsterdam', 'Amsterdam', '阿姆斯特丹', 'アムステルダム', 'NL', 52.37, 4.9],
  ['madrid', 'Madrid', '马德里', 'マドリード', 'ES', 40.42, -3.7],
  ['barcelona', 'Barcelona', '巴塞罗那', 'バルセロナ', 'ES', 41.39, 2.17],
  ['rome', 'Rome', '罗马', 'ローマ', 'IT', 41.9, 12.5, ['Roma']],
  ['milan', 'Milan', '米兰', 'ミラノ', 'IT', 45.46, 9.19, ['Milano']],
  ['vienna', 'Vienna', '维也纳', 'ウィーン', 'AT', 48.21, 16.37, ['Wien']],
  ['zurich', 'Zurich', '苏黎世', 'チューリッヒ', 'CH', 47.38, 8.54, ['Zürich']],
  ['prague', 'Prague', '布拉格', 'プラハ', 'CZ', 50.08, 14.44],
  ['moscow', 'Moscow', '莫斯科', 'モスクワ', 'RU', 55.76, 37.62],
  ['stockholm', 'Stockholm', '斯德哥尔摩', 'ストックホルム', 'SE', 59.33, 18.07],
  ['copenhagen', 'Copenhagen', '哥本哈根', 'コペンハーゲン', 'DK', 55.68, 12.57],
  ['helsinki', 'Helsinki', '赫尔辛基', 'ヘルシンキ', 'FI', 60.17, 24.94],
  ['dublin', 'Dublin', '都柏林', 'ダブリン', 'IE', 53.35, -6.26],
  ['lisbon', 'Lisbon', '里斯本', 'リスボン', 'PT', 38.72, -9.14],
  ['athens', 'Athens', '雅典', 'アテネ', 'GR', 37.98, 23.73],
  // 美洲
  ['newyork', 'New York', '纽约', 'ニューヨーク', 'US', 40.71, -74.01, ['NYC', '紐約']],
  ['losangeles', 'Los Angeles', '洛杉矶', 'ロサンゼルス', 'US', 34.05, -118.24, ['LA']],
  ['sanfrancisco', 'San Francisco', '旧金山', 'サンフランシスコ', 'US', 37.77, -122.42, ['SF', '三藩市']],
  ['seattle', 'Seattle', '西雅图', 'シアトル', 'US', 47.61, -122.33],
  ['chicago', 'Chicago', '芝加哥', 'シカゴ', 'US', 41.88, -87.63],
  ['boston', 'Boston', '波士顿', 'ボストン', 'US', 42.36, -71.06],
  ['washington', 'Washington, D.C.', '华盛顿', 'ワシントン', 'US', 38.91, -77.04],
  ['miami', 'Miami', '迈阿密', 'マイアミ', 'US', 25.76, -80.19],
  ['lasvegas', 'Las Vegas', '拉斯维加斯', 'ラスベガス', 'US', 36.17, -115.14],
  ['houston', 'Houston', '休斯顿', 'ヒューストン', 'US', 29.76, -95.37],
  ['honolulu', 'Honolulu', '檀香山（夏威夷）', 'ホノルル', 'US', 21.31, -157.86, ['Hawaii', '夏威夷', 'ハワイ']],
  ['toronto', 'Toronto', '多伦多', 'トロント', 'CA', 43.65, -79.38],
  ['vancouver', 'Vancouver', '温哥华', 'バンクーバー', 'CA', 49.28, -123.12],
  ['montreal', 'Montreal', '蒙特利尔', 'モントリオール', 'CA', 45.5, -73.57, ['Montréal']],
  ['mexicocity', 'Mexico City', '墨西哥城', 'メキシコシティ', 'MX', 19.43, -99.13],
  ['saopaulo', 'São Paulo', '圣保罗', 'サンパウロ', 'BR', -23.55, -46.63, ['Sao Paulo']],
  ['buenosaires', 'Buenos Aires', '布宜诺斯艾利斯', 'ブエノスアイレス', 'AR', -34.6, -58.38],
  // 大洋洲、非洲
  ['sydney', 'Sydney', '悉尼', 'シドニー', 'AU', -33.87, 151.21],
  ['melbourne', 'Melbourne', '墨尔本', 'メルボルン', 'AU', -37.81, 144.96],
  ['auckland', 'Auckland', '奥克兰', 'オークランド', 'NZ', -36.85, 174.76],
  ['cairo', 'Cairo', '开罗', 'カイロ', 'EG', 30.04, 31.24],
  ['capetown', 'Cape Town', '开普敦', 'ケープタウン', 'ZA', -33.92, 18.42],
  ['nairobi', 'Nairobi', '内罗毕', 'ナイロビ', 'KE', -1.29, 36.82],
]

export const CITIES: City[] = ROWS.map(([id, en, zh, ja, cc, lat, lon, alt]) => ({ id, en, zh, ja, cc, lat, lon, alt }))

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[\s.'’-]/g, '')

export function searchLocalCities(query: string): City[] {
  const q = norm(query)
  if (!q) return []
  const names = (c: City) => [c.en, c.zh, c.ja, ...(c.alt ?? [])].map(norm)
  const starts = CITIES.filter((c) => names(c).some((n) => n.startsWith(q)))
  const contains = CITIES.filter((c) => !starts.includes(c) && names(c).some((n) => n.includes(q)))
  return [...starts, ...contains]
}
