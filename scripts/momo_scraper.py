import sys
import json
import requests  # Changed from playwright
import re
from bs4 import BeautifulSoup

def scrape_momo(search_term, max_results=50):
    # Retrieve API Key from Vercel Environment or use fallback
    import os
    api_key = os.environ.get('ZENROWS_KEY', 'f7fe0f4e76910c69b41317d905194c15226a94f2')
    
    products = []
    # Using the same URL logic as your original script
    search_url = f"https://www.momoshop.com.tw/search/searchShop.jsp?keyword={search_term}&searchType=1"
    
    # ZenRows params to bypass Momo and handle JS rendering
    params = {
        'apikey': api_key,
        'url': search_url,
        'premium_proxy': 'true',
        'proxy_country': 'tw',
        'js_render': 'true',
        'wait_for': '.listArea'
    }

    try:
        # We use requests now because it's lightweight for Vercel
        response = requests.get('https://api.zenrows.com/v1/', params=params, timeout=30)
        if response.status_code != 200:
            return []

        soup = BeautifulSoup(response.text, 'html.parser')
        product_items = soup.select(".listArea li")

        for item in product_items[:max_results]:
            try:
                name_el = item.select_one(".prdName")
                product_name = name_el.get_text(strip=True) if name_el else ""
                if not product_name: continue

                # Link and ID extraction (Keeping your original logic)
                link_el = item.select_one("a")
                href = link_el.get("href") if link_el else ""
                if href.startswith("/"): href = f"https://www.momoshop.com.tw{href}"
                
                product_id = "N/A"
                id_match = re.search(r'i_code=(\d+)', href)
                if id_match:
                    product_id = id_match.group(1)
                    full_link = f"https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code={product_id}"
                else:
                    full_link = href

                price_el = item.select_one(".price .money, .prdPrice")
                price_text = price_el.get_text(strip=True) if price_el else "0"

                # Brand extraction (Keeping your original logic)
                brand_name = "General"
                brand_match = re.search(r'【([^】]+)】', product_name)
                if brand_match:
                    brand_name = brand_match.group(1)

                products.append({
                    "productId": product_id,
                    "brandName": brand_name,
                    "productName": product_name,
                    "productModel": "Standard",
                    "price": f"NT$ {price_text.replace(',', '').strip()}",
                    "link": full_link
                })
            except:
                continue
    except Exception:
        pass
                
    return products

if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(1)
    
    # Keeping your DATA_START/END markers so route.ts can read it
    results = scrape_momo(sys.argv[1], int(sys.argv[2]))
    print("=== DATA_START ===")
    print(json.dumps(results, ensure_ascii=False))
    print("=== DATA_END ===")
