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

    const targetUrl = `https://www.momoshop.com.tw/search/searchShop.jsp?keyword=${encodeURIComponent(searchTerm)}&searchType=1&curPage=1`

    const zenRowsUrl = new URL("https://api.zenrows.com/v1/")
    zenRowsUrl.searchParams.append("apikey", API_KEY)
    zenRowsUrl.searchParams.append("url", targetUrl)
    zenRowsUrl.searchParams.append("js_render", "true")
    zenRowsUrl.searchParams.append("premium_proxy", "true")
    zenRowsUrl.searchParams.append("proxy_country", "tw")

    console.log("[v0] Fetching from ZenRows...")

    const response = await fetch(zenRowsUrl.toString(), {
      method: "GET",
      cache: "no-store",
    })

    if (!response.ok) {
      console.error("[v0] ZenRows error:", response.status, response.statusText)
      return NextResponse.json({ success: false, message: `ZenRows 錯誤：${response.status}` }, { status: 502 })
    }

    const html = await response.text()
    console.log("[v0] Received HTML, length:", html.length)

    console.log("[v0] HTML preview:", html.substring(0, 500))

    const $ = cheerio.load(html)
    const products: any[] = []
    const processedIds = new Set<string>()

    const productSelectors = [
      ".listArea li",
      "li.goodsItemLi",
      ".goodsItemLi",
      "li[data-i_code]",
      ".goodsItem",
      "ul.goodsList li",
    ]

    let foundProducts = false
    for (const selector of productSelectors) {
      const elements = $(selector)
      console.log(`[v0] Trying selector "${selector}": found ${elements.length} elements`)

      if (elements.length > 0) {
        elements.each((i, el) => {
          if (products.length >= maxResults) return false

          const $el = $(el)

          let name = $el.find(".prdName").text().trim()
          if (!name) name = $el.find("h3").text().trim()
          if (!name) name = $el.find(".goodsName").text().trim()
          if (!name) name = $el.find("a[title]").attr("title")?.trim() || ""

          if (!name) return

          let priceText = $el.find(".price .money").text().trim()
          if (!priceText) priceText = $el.find(".price b").text().trim()
          if (!priceText) priceText = $el.find(".prdPrice").text().trim()
          if (!priceText) priceText = $el.find(".money").text().trim()
          if (!priceText) priceText = $el.find("b").text().trim()

          priceText = priceText.replace(/[^\d]/g, "")
          const priceNumber = priceText ? Number.parseInt(priceText, 10) : 0

          let productId = $el.attr("data-i_code") || "N/A"
          let link = ""

          $el.find("a").each((_, linkEl) => {
            const href = $(linkEl).attr("href")
            if (href && href.includes("i_code=")) {
              const match = href.match(/i_code=(\d+)/)
              if (match) {
                productId = match[1]
                link = href.startsWith("http")
                  ? href
                  : `https://www.momoshop.com.tw${href.startsWith("/") ? "" : "/"}${href}`
                return false
              }
            }
          })

          // Skip duplicates
          if (productId !== "N/A" && processedIds.has(productId)) return
          if (productId !== "N/A") processedIds.add(productId)

          if (name && (link || priceNumber > 0)) {
            products.push({
              productName: name,
              price: priceNumber,
              link: link || "#",
            })
          }
        })

        if (products.length > 0) {
          foundProducts = true
          break
        }
      }
    }

    console.log("[v0] Successfully scraped", products.length, "products")

    if (products.length === 0) {
      console.log("[v0] No products found. HTML structure sample:")
      console.log($("body").html()?.substring(0, 1000))
    }

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
