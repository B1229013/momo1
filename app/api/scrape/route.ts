import { type NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const { searchTerm, maxResults = 30 } = await req.json()

    console.log("[v0] Scrape request received:", { searchTerm, maxResults })

    if (!searchTerm) {
      return NextResponse.json({ success: false, message: "Missing searchTerm" }, { status: 400 })
    }

    const API_KEY = process.env.ZENROWS_API_KEY

    if (!API_KEY) {
      console.error("[v0] ZENROWS_API_KEY is not set")
      return NextResponse.json(
        {
          success: false,
          message: "伺服器配置錯誤：缺少 API 金鑰。請在 Vercel 的環境變數中設定 ZENROWS_API_KEY。",
        },
        { status: 500 },
      )
    }

    const products: any[] = []
    const processedIds = new Set<string>()
    let currentPage = 1
    const maxPages = Math.ceil(maxResults / 30) // MoMo shows ~30 products per page

    console.log("[v0] Will scrape up to", maxPages, "pages to get", maxResults, "products")

    while (products.length < maxResults && currentPage <= maxPages) {
      const targetUrl = `https://www.momoshop.com.tw/search/searchShop.jsp?keyword=${encodeURIComponent(searchTerm)}&searchType=1&curPage=${currentPage}`

      const zenRowsUrl = new URL("https://api.zenrows.com/v1/")
      zenRowsUrl.searchParams.append("apikey", API_KEY)
      zenRowsUrl.searchParams.append("url", targetUrl)
      zenRowsUrl.searchParams.append("js_render", "true")
      zenRowsUrl.searchParams.append("premium_proxy", "true")
      zenRowsUrl.searchParams.append("proxy_country", "tw")

      console.log(`[v0] Fetching page ${currentPage} from ZenRows...`)

      const response = await fetch(zenRowsUrl.toString(), {
        method: "GET",
        cache: "no-store",
      })

      if (!response.ok) {
        console.error("[v0] ZenRows error:", response.status, response.statusText)
        break // Stop pagination on error, return what we have
      }

      const html = await response.text()
      console.log(`[v0] Page ${currentPage} - Received HTML, length:`, html.length)

      const $ = cheerio.load(html)
      let pageProducts = 0

      $(".listArea li").each((i, el) => {
        if (products.length >= maxResults) return false

        const $el = $(el)

        // Extract product name
        let name = $el.find(".prdName").text().trim()
        if (!name) name = $el.find("h3").text().trim()
        if (!name) name = $el.find(".goodsName").text().trim()
        if (!name) return

        let productId = "N/A"
        let link = ""

        $el.find("a").each((_, linkEl) => {
          const href = $(linkEl).attr("href")
          if (href && href.includes("i_code=")) {
            const match = href.match(/i_code=(\d+)/)
            if (match) {
              productId = match[1]
              link = href.startsWith("http")
                ? href
                : `https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=${productId}`
              return false // Break the loop
            }
          }
        })

        // Skip if no product ID found or duplicate
        if (productId === "N/A") return
        if (processedIds.has(productId)) return
        processedIds.add(productId)

        // Extract price
        let priceText = $el.find(".price .money").text().trim()
        if (!priceText) priceText = $el.find(".price b").text().trim()
        if (!priceText) priceText = $el.find(".prdPrice").text().trim()

        priceText = priceText.replace(/[^\d]/g, "")
        const priceNumber = priceText ? Number.parseInt(priceText, 10) : 0

        // Extract brand and model (like Python version)
        let brandName = "General"
        const brandMatch = name.match(/【([^】]+)】/)
        if (brandMatch) {
          brandName = brandMatch[1]
        }

        const modelPattern = /([A-Za-z0-9]+-[A-Za-z0-9]+|[A-Z]{2,}[0-9]{2,}[A-Z0-9]*)/
        const modelMatch = name.match(modelPattern)
        const productModel = modelMatch ? modelMatch[1] : "N/A"

        if (name && link && priceNumber > 0) {
          products.push({
            productId,
            brandName,
            productName: name,
            productModel,
            price: priceNumber,
            link,
          })
          pageProducts++
        }
      })

      console.log(`[v0] Page ${currentPage} - Extracted ${pageProducts} products (Total: ${products.length})`)

      // If this page had no products, stop pagination
      if (pageProducts === 0) {
        console.log("[v0] No more products found, stopping pagination")
        break
      }

      currentPage++
    }

    console.log("[v0] Successfully scraped", products.length, "products across", currentPage - 1, "pages")

    return NextResponse.json({
      success: true,
      count: products.length,
      products,
    })
  } catch (err: any) {
    console.error("[v0] Scrape error:", err)
    return NextResponse.json({ success: false, message: `錯誤：${err.message}` }, { status: 500 })
  }
}
