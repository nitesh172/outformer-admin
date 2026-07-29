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

    const responseText = await response.text()

    if (!response.ok) {
      console.error(
        `❌ Config Proxy: Backend returned error status ${response.status}. Body: ${responseText}`
      )
      return NextResponse.json(
        { error: `Backend returned status ${response.status}`, details: responseText },
        { status: response.status }
      )
    }

    try {
      const data = JSON.parse(responseText)
      return NextResponse.json(data)
    } catch (parseError: any) {
      console.error(
        `❌ Config Proxy: Failed to parse backend response as JSON. Body: ${responseText}`
      )
      return NextResponse.json(
        { error: "Invalid JSON response from backend", details: responseText },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("❌ Config Proxy Error:", error.message || error)
    return NextResponse.json(
      { error: "Failed to fetch config", details: error.message || String(error) },
      { status: 500 }
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

    const responseText = await response.text()

    if (!response.ok) {
      console.error(
        `❌ Config Proxy Save Error: Backend returned error status ${response.status}. Body: ${responseText}`
      )
      return NextResponse.json(
        { error: `Backend returned status ${response.status}`, details: responseText },
        { status: response.status }
      )
    }

    try {
      const data = JSON.parse(responseText)
      return NextResponse.json(data)
    } catch (parseError: any) {
      console.error(
        `❌ Config Proxy Save Error: Failed to parse backend response as JSON. Body: ${responseText}`
      )
      return NextResponse.json(
        { error: "Invalid JSON response from backend", details: responseText },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("❌ Config Proxy Save Error:", error.message || error)
    return NextResponse.json(
      { error: "Failed to update config", details: error.message || String(error) },
      { status: 500 }
    )
  }
}
