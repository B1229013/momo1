import sys
import json
import requests
import re
from bs4 import BeautifulSoup

def scrape_momo(search_term, max_results=50):
    products = []
    search_url = f"https://www.momoshop.com.tw/search/searchShop.jsp?keyword={search_term}&searchType=1"
    
    # Standard headers to mimic a browser
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9',
        'Referer': 'https://www.momoshop.com.tw/'
    }

    try:
        response = requests.get(search_url, headers=headers, timeout=15)
        if response.status_code != 200:
            return []

        soup = BeautifulSoup(response.text, 'html.parser')
        product_items = soup.select(".listArea li")

        for item in product_items[:max_results]:
            try:
                name_el = item.select_one(".prdName") or item.select_one("h3")
                product_name = name_el.get_text(strip=True) if name_el else ""
                if not product_name: continue

                link_el = item.select_one("a")
                href = link_el.get("href") if link_el else ""
                
                id_match = re.search(r'i_code=(\d+)', href)
                if id_match:
                    product_id = id_match.group(1)
                    full_link = f"https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code={product_id}"
                else:
                    continue

                price_el = item.select_one(".price .money, .prdPrice")
                price_text = price_el.get_text(strip=True) if price_el else "0"
                price_cleaned = re.sub(r'[^\d]', '', price_text)

                brand_name = "General"
                brand_match = re.search(r'【([^】]+)】', product_name)
                if brand_match:
                    brand_name = brand_match.group(1)

                products.append({
                    "productId": product_id,
                    "brandName": brand_name,
                    "productName": product_name,
                    "productModel": "Standard",
                    "price": int(price_cleaned) if price_cleaned else 0,
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
    
    results = scrape_momo(sys.argv[1], int(sys.argv[2]))
    print("=== DATA_START ===")
    print(json.dumps(results, ensure_ascii=False))
    print("=== DATA_END ===")
