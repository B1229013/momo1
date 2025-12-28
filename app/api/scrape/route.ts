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

    const ZENROWS_API_KEY = process.env.ZENROWS_API_KEY

    if (!ZENROWS_API_KEY) {
      return NextResponse.json(
        { success: false, message: "Missing ZENROWS_API_KEY environment variable" },
        { status: 500 },
      )
    }

    const products: any[] = []
    const processedIds = new Set<string>()
    let currentPage = 1
    const maxPages = Math.ceil(maxResults / 30)

    console.log("[v0] Will scrape up to", maxPages, "pages to get", maxResults, "products")

    while (products.length < maxResults && currentPage <= maxPages) {
      const searchKeyword = encodeURIComponent(searchTerm)
      const targetUrl = `https://www.momoshop.com.tw/search/searchShop.jsp?keyword=${searchKeyword}&searchType=1&curPage=${currentPage}`

      console.log(`[v0] Fetching page ${currentPage} from:`, targetUrl)

      const zenrowsUrl = new URL("https://api.zenrows.com/v1/")
      zenrowsUrl.searchParams.set("apikey", ZENROWS_API_KEY)
      zenrowsUrl.searchParams.set("url", targetUrl)
      zenrowsUrl.searchParams.set("js_render", "true")
      zenrowsUrl.searchParams.set("premium_proxy", "true")
      zenrowsUrl.searchParams.set("proxy_country", "tw")

      try {
        const response = await fetch(zenrowsUrl.toString())

        console.log(`[v0] Page ${currentPage} - Status: ${response.status}`)

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[v0] ZenRows error:", response.status, errorText)
          return NextResponse.json(
            { success: false, message: `ZenRows API error: ${response.status}` },
            { status: 500 },
          )
        }

        const html = await response.text()
        const $ = cheerio.load(html)

        console.log("[v0] Debugging HTML structure:")
        console.log("[v0] .listArea li count:", $(".listArea li").length)
        console.log("[v0] ul.productList li count:", $("ul.productList li").length)
        console.log("[v0] .product-item count:", $(".product-item").length)
        console.log("[v0] [class*='product'] count:", $("[class*='product']").length)
        console.log("[v0] .goodsUrl count:", $(".goodsUrl").length)
        console.log("[v0] .goods_url count:", $(".goods_url").length)

        $("li")
          .slice(0, 5)
          .each((i, el) => {
            const classes = $(el).attr("class")
            const hasLink = $(el).find("a").length > 0
            if (hasLink && classes) {
              console.log(`[v0] Found li with classes: ${classes}, has ${$(el).find("a").length} links`)
            }
          })

        let pageProducts = 0

        const selectors = [
          ".listArea li",
          "ul.productList li",
          "ul.productList.clearfix li",
          ".goodsUrl",
          "li.goodsUrl",
          "[class*='goods']",
          "li[class*='product']",
        ]

        for (const selector of selectors) {
          const elements = $(selector)
          console.log(`[v0] Trying selector "${selector}": found ${elements.length} elements`)

          if (elements.length > 0) {
            elements.each((i, el) => {
              if (products.length >= maxResults) return false

              const $el = $(el)

              let name = $el.find(".prdName").text().trim()
              if (!name) name = $el.find("h3").text().trim()
              if (!name) name = $el.find(".goodsName").text().trim()
              if (!name) name = $el.find("p.prdName").text().trim()
              if (!name) name = $el.find(".name").text().trim()
              if (!name) name = $el.find("a").attr("title") || ""

              console.log(`[v0] Element ${i}: name="${name}"`)

              if (!name) return

              let productId = "N/A"
              let link = ""

              $el.find("a").each((_, linkEl) => {
                const href = $(linkEl).attr("href")
                if (href && href.includes("i_code=")) {
                  const match = href.match(/i_code=(\d+)/)
                  if (match) {
                    productId = match[1]
                    link = href.startsWith("http") ? href : `https://www.momoshop.com.tw${href}`
                    return false
                  }
                }
              })

              if (productId === "N/A") {
                console.log(`[v0] No product ID found for: ${name}`)
                return
              }
              if (processedIds.has(productId)) return
              processedIds.add(productId)

              let priceText = $el.find(".price .money").text().trim()
              if (!priceText) priceText = $el.find(".price b").text().trim()
              if (!priceText) priceText = $el.find(".prdPrice").text().trim()
              if (!priceText) priceText = $el.find("b.price").text().trim()
              if (!priceText) priceText = $el.find(".selling-price").text().trim()

              priceText = priceText.replace(/[^\d]/g, "")
              const priceNumber = priceText ? Number.parseInt(priceText, 10) : 0

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
                console.log(`[v0] Added product: ${name} - $${priceNumber}`)
              }
            })

            // If we found products with this selector, break out of selector loop
            if (pageProducts > 0) {
              console.log(`[v0] Success with selector: ${selector}`)
              break
            }
          }
        }

        console.log(`[v0] Page ${currentPage} - Extracted ${pageProducts} products (Total: ${products.length})`)

        if (pageProducts === 0) {
          console.log("[v0] No more products found, stopping pagination")
          break
        }

        currentPage++

        if (currentPage <= maxPages) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } catch (err: any) {
        console.error("[v0] Error fetching page", currentPage, ":", err.message)
        break
      }
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
