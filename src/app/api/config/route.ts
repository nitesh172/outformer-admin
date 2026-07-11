import { NextResponse } from "next/server"

const API_URL = process.env.NEXT_PUBLIC_API_URL
const API_SECRET = process.env.API_SECRET

export async function GET() {
  console.log(`📡 Config Proxy: GET request to ${API_URL}/config/interview`)

  if (!API_SECRET) {
    console.error(
      "❌ Config Proxy: API_SECRET is not defined in environment variables",
    )
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    )
  }

  try {
    const response = await fetch(`${API_URL}/config/interview`, {
      headers: {
        "x-outerformer-api-key": API_SECRET,
      },
      cache: "no-store",
    })

    console.log(
      `📡 Config Proxy: Backend responded with status ${response.status}`,
    )

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("❌ Config Proxy Error:", error.message)
    return NextResponse.json(
      { error: "Failed to fetch config", details: error.message },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  console.log(`📡 Config Proxy: POST request to ${API_URL}/config/interview`)

  if (!API_SECRET) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    )
  }

  try {
    const body = await request.json()
    const response = await fetch(`${API_URL}/config/interview`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-outerformer-api-key": API_SECRET,
      },
      body: JSON.stringify(body),
    })

    console.log(
      `📡 Config Proxy: Backend responded with status ${response.status}`,
    )

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: any) {
    console.error("❌ Config Proxy Save Error:", error.message)
    return NextResponse.json(
      { error: "Failed to update config", details: error.message },
      { status: 500 },
    )
  }
}
