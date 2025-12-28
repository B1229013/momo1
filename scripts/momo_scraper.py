import sys
import json
import asyncio
from playwright.async_api import async_playwright
import re

async def scrape_momo(search_term: str, max_results: int = 50):
    products = []
    processed_ids = set()
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Use a high-quality browser context
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        current_page_num = 1
        
        # Keep looping until we have enough products
        while len(products) < max_results and current_page_num <= 10:
            # We force the page number in the URL
            search_url = f"https://www.momoshop.com.tw/search/searchShop.jsp?keyword={search_term}&searchType=1&curPage={current_page_num}"
            
            try:
                await page.goto(search_url, wait_until="domcontentloaded", timeout=60000)
                
                # Wait for the list area to exist
                await page.wait_for_selector(".listArea", timeout=15000)
                
                # Scroll to bottom to trigger lazy prices/images
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                await asyncio.sleep(2) 

                product_items = await page.query_selector_all(".listArea li")
                
                # If no items found on this page, the search results have ended
                if not product_items:
                    break

                for item in product_items:
                    if len(products) >= max_results:
                        break
                        
                    try:
                        name_el = await item.query_selector(".prdName")
                        product_name = (await name_el.inner_text()).strip() if name_el else ""
                        if not product_name: continue

                        # Link and ID extraction
                        all_links = await item.query_selector_all("a")
                        full_link = ""
                        product_id = "N/A"
                        
                        for a_tag in all_links:
                            href = await a_tag.get_attribute("href")
                            if not href or href == "#": continue
                            if href.startswith("/"): href = f"https://www.momoshop.com.tw{href}"
                            
                            if "i_code=" in href:
                                id_match = re.search(r'i_code=(\d+)', href)
                                if id_match:
                                    product_id = id_match.group(1)
                                    full_link = f"https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code={product_id}"
                                    break
                        
                        # Prevent duplicates across pages
                        if product_id != "N/A" and product_id in processed_ids:
                            continue
                        if product_id != "N/A":
                            processed_ids.add(product_id)

                        price_el = await item.query_selector(".price .money, .price b, .prdPrice")
                        price_text = await price_el.inner_text() if price_el else "0"

                        brand_name = "General"
                        brand_match = re.search(r'【([^】]+)】', product_name)
                        if brand_match:
                            brand_name = brand_match.group(1)

                        model_pattern = r'([A-Za-z0-9]+-[A-Za-z0-9]+|[A-Z]{2,}[0-9]{2,}[A-Z0-9]*)'
                        model_search = re.search(model_pattern, product_name)
                        product_model = model_search.group(1) if model_search else "N/A"

                        if full_link and full_link != "#":
                            products.append({
                                "productId": product_id,
                                "brandName": brand_name,
                                "productName": product_name,
                                "productModel": product_model,
                                "price": f"NT$ {price_text.replace(',', '').strip()}",
                                "link": full_link
                            })
                    except:
                        continue
                
                # Move to the next page
                current_page_num += 1
                
            except Exception:
                # If we hit an error (like a timeout on Page 3), return what we have
                break
                
        await browser.close()
    return products

async def main():
    if len(sys.argv) < 3: return
    # sys.argv[2] is the limit from your slider/API
    results = await scrape_momo(sys.argv[1], int(sys.argv[2]))
    print("=== DATA_START ===")
    print(json.dumps(results, ensure_ascii=False))
    print("=== DATA_END ===")

if __name__ == "__main__":
    asyncio.run(main())