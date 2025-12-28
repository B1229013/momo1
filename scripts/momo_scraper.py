import sys
import json
import asyncio
import re
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup

async def scrape_momo(search_term, max_results=50):
    products = []
    
    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        # Target URL
        url = f"https://www.momoshop.com.tw/search/searchShop.jsp?keyword={search_term}&searchType=1"
        
        try:
            # Go to page and wait until network is idle
            await page.goto(url, wait_until="networkidle", timeout=60000)
            
            # Wait for the product list to appear
            await page.wait_for_selector(".listArea", timeout=10000)
            
            # Scroll down to trigger lazy loading if needed
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight / 2)")
            await asyncio.sleep(1) 
            
            # Get HTML content
            content = await page.content()
            soup = BeautifulSoup(content, 'html.parser')
            
            # Find all product items
            product_items = soup.select(".listArea li")
            
            for item in product_items[:max_results]:
                try:
                    # Extract Name
                    name_el = item.select_one(".prdName")
                    product_name = name_el.get_text(strip=True) if name_el else ""
                    if not product_name:
                        continue
                        
                    # Extract Link and ID
                    link_el = item.select_one("a")
                    href = link_el.get("href") if link_el else ""
                    if href.startswith("/"):
                        href = f"https://www.momoshop.com.tw{href}"
                    
                    product_id = "N/A"
                    id_match = re.search(r'i_code=(\d+)', href)
                    if id_match:
                        product_id = id_match.group(1)
                        full_link = f"https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code={product_id}"
                    else:
                        full_link = href

                    # Extract Price
                    price_el = item.select_one(".price .money, .prdPrice")
                    price_text = price_el.get_text(strip=True) if price_el else "0"
                    
                    # Extract Brand (from brackets 【 】)
                    brand_name = "General"
                    brand_match = re.search(r'【([^】]+)】', product_name)
                    if brand_match:
                        brand_name = brand_match.group(1)

                    products.append({
                        "productId": product_id,
                        "brandName": brand_name,
                        "productName": product_name,
                        "productModel": "Standard",
                        "price": price_text.replace(',', '').strip(),
                        "link": full_link
                    })
                except Exception as e:
                    continue
                    
        except Exception as e:
            # Silence errors for clean JSON output
            pass
        finally:
            await browser.close()
            
    return products

if __name__ == "__main__":
    # Get arguments from Node.js child_process
    if len(sys.argv) < 3:
        sys.exit(1)
        
    keyword = sys.argv[1]
    limit = int(sys.argv[2])
    
    # Run the async function
    results = asyncio.run(scrape_momo(keyword, limit))
    
    # Print markers for Node.js to parse
    print("=== DATA_START ===")
    print(json.dumps(results, ensure_ascii=False))
    print("=== DATA_END ===")
