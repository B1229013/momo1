"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Card } from "@/components/ui/card"
import { Download, Search, AlertCircle, ExternalLink, Sparkles, Send, Paperclip, Globe, ArrowRight, RotateCcw } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import * as XLSX from "xlsx"

interface Product {
  productId: string; // Added back
  brandName: string;
  productName: string;
  productModel: string;
  price: string;
  link: string;
}

export default function ScraperPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [maxResults, setMaxResults] = useState([50])
  const [isLoading, setIsLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [successMessage, setSuccessMessage] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const handleSearch = async () => {
    if (!searchTerm.trim()) return

    setIsLoading(true)
    setSuccessMessage("")
    setErrorMessage("")
    setProducts([])

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchTerm,
          maxResults: maxResults[0],
        }),
      })

      const data = await response.json()

      if (data.success && data.products && data.products.length > 0) {
        setProducts(data.products)
        setSuccessMessage(`成功擷取 ${data.products.length} 項商品！`)
      } else {
        setErrorMessage(data.message || "無法擷取數據。請稍後再試。")
      }
    } catch (error) {
      setErrorMessage("連線失敗。請檢查您的網路或稍後再試。")
    } finally {
      setIsLoading(false)
    }
  }

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      products.map((p, idx) => ({
        "序號": idx + 1,
        "品號": p.productId,
        "品牌": p.brandName,
        "商品名稱": p.productName,
        "型號": p.productModel,
        "價格": p.price,
        "連結": p.link,
      })),
    )
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "商品列表")
    XLSX.writeFile(workbook, `momo_搜尋結果_${searchTerm}.xlsx`)
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* --- Header Section --- */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold mb-4 tracking-tight">
            「您好，<span className="text-purple-400">使用者</span>」
          </h1>
          <h2 className="text-3xl font-bold text-gray-400">想搜尋什麼商品？</h2>
          <p className="text-gray-500 mt-2">請在下方輸入關鍵字，開始從 Momo 擷取即時資訊</p>
        </div>


        {/* --- Floating White Search Bar --- */}
        <div className="bg-white rounded-3xl p-4 mb-8 shadow-2xl relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="請輸入商品名稱... (例如: 吹風機, 筆電)"
            className="w-full text-black text-xl outline-none px-4 py-4 placeholder-gray-400"
          />
          
          <div className="flex flex-col md:flex-row items-center justify-between border-t border-gray-100 pt-4 mt-2 px-2 gap-4">
            <div className="flex items-center gap-6 w-full md:w-1/2">
               <div className="flex flex-col w-full gap-2">
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase">擷取數量</span>
                    <span className="text-xs font-bold text-purple-600">{maxResults[0]} 項</span>
                  </div>
                  <Slider
                    value={maxResults}
                    onValueChange={setMaxResults}
                    min={10} max={100} step={10}
                    className="py-2"
                  />
               </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={handleSearch}
                disabled={isLoading || !searchTerm.trim()}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 p-4 rounded-2xl transition-all shadow-lg active:scale-95"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ArrowRight className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* --- Feedback Messages --- */}
        {successMessage && (
          <Alert className="mb-6 bg-purple-900/20 border-purple-500/50 text-purple-200">
            <Sparkles className="w-4 h-4" />
            <AlertDescription className="ml-2">{successMessage}</AlertDescription>
          </Alert>
        )}
        {errorMessage && (
          <Alert className="mb-6 bg-red-900/20 border-red-500/50 text-red-200">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="ml-2">{errorMessage}</AlertDescription>
          </Alert>
        )}

        {/* --- Results Table --- */}
        {products.length > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#1e1e1e] border border-gray-800 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[#252525] border-b border-gray-800">
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">品號</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">品牌</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">商品名稱</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase">型號</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-purple-400">價格</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {products.map((product, idx) => (
                      <tr key={idx} className="hover:bg-purple-500/5 transition-colors group">
                        <td className="px-6 py-4 text-sm font-mono text-gray-500">{product.productId}</td>
                        <td className="px-6 py-4 text-sm font-bold text-purple-400">{product.brandName}</td>
                        <td className="px-6 py-4 text-sm text-gray-300 max-w-xs truncate">{product.productName}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">{product.productModel}</td>
                        <td className="px-6 py-4 text-sm font-black text-white">{product.price}</td>
                        <td className="px-6 py-4 text-center">
                          <a href={product.link} target="_blank" rel="noopener noreferrer" 
                             className="inline-flex p-2 rounded-full bg-gray-800 group-hover:bg-purple-600 transition-all">
                            <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-white" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-center pb-12">
              <Button
                onClick={exportToExcel}
                size="lg"
                className="bg-white hover:bg-gray-100 text-black gap-2 px-10 h-14 rounded-2xl font-bold shadow-xl transition-transform hover:scale-105"
              >
                <Download className="w-5 h-5" />
                下載 Excel 報表
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!products.length && !isLoading && (
          <div className="text-center py-20 opacity-40">
            <div className="bg-gray-800/50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="w-12 h-12 text-gray-600" />
            </div>
            <p className="text-2xl font-bold text-gray-600">等待搜尋指令</p>
          </div>
        )}
      </div>
    </div>
  )

}

