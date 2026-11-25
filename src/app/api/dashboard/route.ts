import { NextResponse } from "next/server";
import * as admin from "firebase-admin";
import { validateEnv } from "@/lib/env";
import { rateLimit, authenticateRequest, handleError } from "@/lib/api-helpers";
import { resolvePaymentFinancials } from "@/lib/financials.utils";

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  } catch (error: any) {
    console.error("Firebase admin initialization error:", error?.message || "Unknown error");
  }
}

export async function GET(request: Request) {
  try {
    validateEnv();
    rateLimit(request);
    await authenticateRequest(request, false);

    const db = admin.firestore();
    const url = new URL(request.url);
    const targetMonth = parseInt(url.searchParams.get("month") || String(new Date().getMonth()), 10);
    const targetYear = parseInt(url.searchParams.get("year") || String(new Date().getFullYear()), 10);

    const [userSnap, packageSnap, paymentSnap] = await Promise.all([
      db.collection("users").get(),
      db.collection("packages").get(),
      db.collection("payments").where("status", "==", "SUCCESS").get(),
    ]);

    let totalGross = 0;
    let totalNet = 0;
    let totalFees = 0;

    let monthlyGross = 0;
    let monthlyNet = 0;
    let monthlyFees = 0;

    let yearlyGross = 0;
    let yearlyNet = 0;
    let yearlyFees = 0;

    let prevMonthGross = 0;
    let prevMonthNet = 0;

    const packageBreakdown: Record<string, { gross: number; net: number; count: number }> = {};
    const monthlyMap: Record<string, { gross: number; net: number; fees: number }> = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // Initialize 6 months range
    for (let i = 5; i >= 0; i--) {
      const d = new Date(targetYear, targetMonth - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap[key] = { gross: 0, net: 0, fees: 0 };
    }

    const prevMonthDate = new Date(targetYear, targetMonth - 1, 1);

    paymentSnap.docs.forEach((doc) => {
      const data = doc.data();
      const fin = resolvePaymentFinancials(data);
      const gross = fin.grossAmount;
      const net = fin.netSettlementAmount;
      const fees = fin.gatewayTotalFee;

      totalGross += gross;
      totalNet += net;
      totalFees += fees;

      const createdAt = data.createdAt;
      let date: Date | null = null;
      if (createdAt?.toDate) {
        date = createdAt.toDate();
      } else if (createdAt?.seconds) {
        date = new Date(createdAt.seconds * 1000);
      } else if (createdAt) {
        date = new Date(createdAt);
      }

      if (date && !isNaN(date.getTime())) {
        const pMonth = date.getMonth();
        const pYear = date.getFullYear();

        if (pYear === targetYear) {
          yearlyGross += gross;
          yearlyNet += net;
          yearlyFees += fees;
        }

        if (pYear === targetYear && pMonth === targetMonth) {
          monthlyGross += gross;
          monthlyNet += net;
          monthlyFees += fees;

          const packName = data.packInfo?.name || "Pro Membership Only";
          if (!packageBreakdown[packName]) {
            packageBreakdown[packName] = { gross: 0, net: 0, count: 0 };
          }
          packageBreakdown[packName].gross += gross;
          packageBreakdown[packName].net += net;
          packageBreakdown[packName].count += 1;
        }

        if (pYear === prevMonthDate.getFullYear() && pMonth === prevMonthDate.getMonth()) {
          prevMonthGross += gross;
          prevMonthNet += net;
        }

        const key = `${pYear}-${String(pMonth + 1).padStart(2, "0")}`;
        if (monthlyMap[key]) {
          monthlyMap[key].gross += gross;
          monthlyMap[key].net += net;
          monthlyMap[key].fees += fees;
        }
      }
    });

    const monthlyGrowth = prevMonthGross > 0
      ? Math.round(((monthlyGross - prevMonthGross) / prevMonthGross) * 100)
      : monthlyGross > 0 ? 100 : 0;

    const monthlyNetGrowth = prevMonthNet > 0
      ? Math.round(((monthlyNet - prevMonthNet) / prevMonthNet) * 100)
      : monthlyNet > 0 ? 100 : 0;

    const trend = Object.entries(monthlyMap).map(([key, val]) => {
      const [year, monthStr] = key.split("-");
      const mIdx = parseInt(monthStr, 10) - 1;
      return {
        monthLabel: `${monthNames[mIdx]} '${year.substring(2)}`,
        grossAmount: Number(val.gross.toFixed(2)),
        netAmount: Number(val.net.toFixed(2)),
        fees: Number(val.fees.toFixed(2)),
      };
    });

    return NextResponse.json({
      success: true,
      stats: {
        users: userSnap.size,
        packages: packageSnap.size,
      },
      financials: {
        allTime: {
          grossRevenue: Number(totalGross.toFixed(2)),
          netRevenue: Number(totalNet.toFixed(2)),
          gatewayFees: Number(totalFees.toFixed(2)),
        },
        selectedMonth: {
          month: targetMonth,
          year: targetYear,
          grossRevenue: Number(monthlyGross.toFixed(2)),
          netRevenue: Number(monthlyNet.toFixed(2)),
          gatewayFees: Number(monthlyFees.toFixed(2)),
          growthPercentage: monthlyGrowth,
          netGrowthPercentage: monthlyNetGrowth,
        },
        selectedYear: {
          year: targetYear,
          grossRevenue: Number(yearlyGross.toFixed(2)),
          netRevenue: Number(yearlyNet.toFixed(2)),
          gatewayFees: Number(yearlyFees.toFixed(2)),
        },
      },
      monthlyTrend: trend,
      packageBreakdown,
    });
  } catch (error: any) {
    return handleError(error);
  }
}

