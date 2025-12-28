import { type NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { searchTerm, maxResults = 30 } = await req.json()

    if (!searchTerm) {
      return NextResponse.json({ success: false, message: "Missing searchTerm" }, { status: 400 })
    }

    const products: any[] = []
    const processedIds = new Set<string>()
    let currentPage = 1
    const maxPages = Math.ceil(maxResults / 30)

    while (products.length < maxResults && currentPage <= maxPages) {
      const targetUrl = `https://www.momoshop.com.tw/search/searchShop.jsp?keyword=${encodeURIComponent(searchTerm)}&searchType=1&curPage=${currentPage}`

      // Direct fetch with User-Agent to mimic a real browser
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
          "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
          "Referer": "https://www.momoshop.com.tw/",
        },
        cache: "no-store",
      })

      if (!response.ok) {
        console.error("[v0] Momo blocked request:", response.status)
        break 
      }

      const html = await response.text()
      const $ = cheerio.load(html)
      let pageProducts = 0

      $(".listArea li").each((i, el) => {
        if (products.length >= maxResults) return false
        const $el = $(el)

        let name = $el.find(".prdName").text().trim() || $el.find("h3").text().trim() || $el.find(".goodsName").text().trim()
        if (!name) return

        let productId = "N/A"
        let link = ""

        $el.find("a").each((_, linkEl) => {
          const href = $(linkEl).attr("href")
          if (href && href.includes("i_code=")) {
            const match = href.match(/i_code=(\d+)/)
            if (match) {
              productId = match[1]
              link = `https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=${productId}`
              return false 
            }
          }
        })

        if (productId === "N/A" || processedIds.has(productId)) return
        processedIds.add(productId)

        let priceText = $el.find(".price .money").text().trim() || $el.find(".prdPrice").text().trim()
        const priceNumber = Number.parseInt(priceText.replace(/[^\d]/g, ""), 10) || 0

        let brandName = "General"
        const brandMatch = name.match(/【([^】]+)】/)
        if (brandMatch) brandName = brandMatch[1]

        const modelMatch = name.match(/([A-Za-z0-9]+-[A-Za-z0-9]+|[A-Z]{2,}[0-9]{2,}[A-Z0-9]*)/)
        const productModel = modelMatch ? modelMatch[1] : "N/A"

        if (name && link) {
          products.push({ productId, brandName, productName: name, productModel, price: priceNumber, link })
          pageProducts++
        }
      })

      if (pageProducts === 0) break
      currentPage++
    }

    return NextResponse.json({ success: true, count: products.length, products })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: `錯誤：${err.message}` }, { status: 500 })
  }
}
