import { type NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(request: NextRequest) {
  try {
    const { searchTerm, maxResults = 50 } = await request.json();
    const scriptPath = path.join(process.cwd(), "scripts", "momo_scraper.py");

    console.log(`Starting scrape for: ${searchTerm}, Limit: ${maxResults}`);

    return new Promise((resolve) => {
      // Try "python3" if "python" fails on your machine
      const pythonProcess = spawn("python", [scriptPath, searchTerm, maxResults.toString()]);
      
      let resultData = "";
      let errorData = "";

      pythonProcess.stdout.on("data", (data) => { 
        resultData += data.toString(); 
      });

      // CAPTURE ERRORS: This will show you Python crashes in your terminal
      pythonProcess.stderr.on("data", (data) => {
        errorData += data.toString();
        console.error(`Python Error: ${data.toString()}`);
      });

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          console.error(`Process exited with code ${code}. Error: ${errorData}`);
          return resolve(NextResponse.json({ 
            success: false, 
            message: "Python script failed. Check server logs." 
          }, { status: 500 }));
        }

        const jsonMatch = resultData.match(/=== DATA_START ===\s*([\s\S]*?)\s*=== DATA_END ===/);
        
        if (jsonMatch) {
          try {
            const products = JSON.parse(jsonMatch[1]);
            resolve(NextResponse.json({ success: true, products }));
          } catch (e) {
            resolve(NextResponse.json({ success: false, message: "Failed to parse Python output" }));
          }
        } else {
          resolve(NextResponse.json({ success: false, message: "No data found in script output" }));
        }
      });
    });
  } catch (error) {
    console.error("API Route Error:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}