"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Users, Package, TrendingUp, TrendingDown, DollarSign, Calendar, RefreshCcw, CreditCard, ChevronRight } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    users: 0,
    packages: 0,
  });
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<"monthly" | "yearly" | "total">("monthly");
  const [breakdownView, setBreakdownView] = useState<"list" | "visual">("visual");

  async function fetchDashboardData() {
    setLoading(true);
    try {
      setError(null);
      
      // 1. Fetch Users & Packages counts
      const userSnap = await getDocs(collection(db, "users"));
      const packageSnap = await getDocs(collection(db, "packages"));
      
      setStats({
        users: userSnap.size,
        packages: packageSnap.size,
      });

      // 2. Fetch Payments collection
      const paymentSnap = await getDocs(collection(db, "payments"));
      const successPayments = paymentSnap.docs
        .map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          parsedDate: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : (doc.data().createdAt?.seconds ? new Date(doc.data().createdAt.seconds * 1000) : null)
        }))
        .filter((p: any) => p.status === 'SUCCESS');

      setPaymentsList(successPayments);

    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      if (error.code === 'permission-denied') {
        setError("Access Denied: You don't have permission to query dashboard data. Please double check roles.");
      } else {
        setError("Failed to fetch dashboard revenue details.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Recalculate stats dynamically based on payments list and selectors
  const {
    totalRevenue,
    monthlyRevenue,
    yearlyRevenue,
    monthlyGrowth,
    packageBreakdown,
    monthlyTrend,
    recentSales,
    availableYears
  } = useMemo(() => {
    let total = 0;
    let monthly = 0;
    let yearly = 0;
    let prevMonthRevenue = 0;
    const packBreakdown: Record<string, number> = {};
    const monthlyMap: Record<string, number> = {};
    const yearsSet = new Set<number>([new Date().getFullYear()]);

    const targetMonth = selectedMonth;
    const targetYear = selectedYear;
    const prevMonthDate = new Date(targetYear, targetMonth - 1, 1);

    // Initialize last 6 months based on SELECTED month/year (the chart updates around the selected date)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(targetYear, targetMonth - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[key] = 0;
    }

    paymentsList.forEach((p: any) => {
      const amt = Number(p.amount) || 0;
      total += amt;

      const date = p.parsedDate;
      if (date) {
        const pMonth = date.getMonth();
        const pYear = date.getFullYear();
        yearsSet.add(pYear);

        // Selected Year Check
        if (pYear === targetYear) {
          yearly += amt;
        }

        // Selected Month Check
        if (pYear === targetYear && pMonth === targetMonth) {
          monthly += amt;
        }

        // Previous Month Check (relative to selected month/year)
        if (pYear === prevMonthDate.getFullYear() && pMonth === prevMonthDate.getMonth()) {
          prevMonthRevenue += amt;
        }

        // Map for trend chart (last 6 months relative to selected date)
        const key = `${pYear}-${String(pMonth + 1).padStart(2, '0')}`;
        if (key in monthlyMap) {
          monthlyMap[key] += amt;
        }
      }

      // Package distribution matches selected timeframe
      const matchesTimeframe = () => {
        if (!date) return false;
        if (timeframe === "monthly") {
          return date.getFullYear() === targetYear && date.getMonth() === targetMonth;
        }
        if (timeframe === "yearly") {
          return date.getFullYear() === targetYear;
        }
        return true; // All Time
      };

      if (matchesTimeframe()) {
        const packName = p.packInfo?.name || "Pro Membership Only";
        packBreakdown[packName] = (packBreakdown[packName] || 0) + amt;
      }
    });

    // Format monthly trend array
    const trend = Object.entries(monthlyMap).map(([key, amount]) => {
      const [year, monthStr] = key.split('-');
      const mIdx = parseInt(monthStr, 10) - 1;
      return {
        monthLabel: `${monthNames[mIdx]} '${year.substring(2)}`,
        amount
      };
    });

    // Calculate growth percentage
    let growth = 0;
    if (prevMonthRevenue > 0) {
      growth = Math.round(((monthly - prevMonthRevenue) / prevMonthRevenue) * 100);
    } else if (monthly > 0) {
      growth = 100;
    }

    // Sort recent sales
    const sortedRecent = [...paymentsList]
      .sort((a: any, b: any) => (b.parsedDate || 0) - (a.parsedDate || 0))
      .slice(0, 5);

    return {
      totalRevenue: total,
      monthlyRevenue: monthly,
      yearlyRevenue: yearly,
      monthlyGrowth: growth,
      packageBreakdown: packBreakdown,
      monthlyTrend: trend,
      recentSales: sortedRecent,
      availableYears: Array.from(yearsSet).sort((a, b) => b - a)
    };
  }, [paymentsList, selectedMonth, selectedYear, timeframe]);

  const maxTrendAmount = Math.max(...monthlyTrend.map(t => t.amount), 1);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div>
      <div className="title-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1>Dashboard Overview</h1>
          <p>Inspect financial trend charts, package details, and logs by selecting custom time periods.</p>
        </div>
        <button 
          onClick={fetchDashboardData} 
          disabled={loading}
          className="btn btn-outline"
          style={{ padding: '8px 12px', fontSize: '13px' }}
        >
          <RefreshCcw size={16} className={loading ? 'spin' : ''} style={{ marginRight: '6px' }} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ 
          background: 'rgba(239, 68, 68, 0.1)', 
          border: '1px solid #ef4444', 
          color: '#ef4444', 
          padding: '16px', 
          borderRadius: '12px', 
          marginBottom: '24px',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {/* Dynamic Month/Year Timeline Filter Bar (Admin-only) */}
      {isAdmin && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          background: '#0a0a0a', 
          border: '1px solid var(--border)', 
          borderRadius: '12px',
          padding: '12px 20px',
          marginBottom: '24px',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 600 }}>Package View Breakdowns:</span>
            <div style={{ display: 'flex', gap: '4px', background: '#141414', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <button 
                onClick={() => setTimeframe("monthly")}
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: timeframe === "monthly" ? "var(--primary)" : "none",
                  border: 'none',
                  color: timeframe === "monthly" ? "white" : "#9ca3af",
                  transition: 'all 0.2s'
                }}
              >
                Selected Month
              </button>
              <button 
                onClick={() => setTimeframe("yearly")}
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: timeframe === "yearly" ? "var(--primary)" : "none",
                  border: 'none',
                  color: timeframe === "yearly" ? "white" : "#9ca3af",
                  transition: 'all 0.2s'
                }}
              >
                Selected Year
              </button>
              <button 
                onClick={() => setTimeframe("total")}
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '6px 14px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  background: timeframe === "total" ? "var(--primary)" : "none",
                  border: 'none',
                  color: timeframe === "total" ? "white" : "#9ca3af",
                  transition: 'all 0.2s'
                }}
              >
                All Time
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 600 }}>Filter Month:</label>
              <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                style={{ 
                  background: '#141414', 
                  border: '1px solid var(--border)', 
                  borderRadius: '8px', 
                  color: 'white', 
                  padding: '8px 12px', 
                  fontSize: '13px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {monthNames.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 600 }}>Filter Year:</label>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                style={{ 
                  background: '#141414', 
                  border: '1px solid var(--border)', 
                  borderRadius: '8px', 
                  color: 'white', 
                  padding: '8px 12px', 
                  fontSize: '13px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {availableYears.map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Grid: Performance Metrics (Admin-only detailed cards vs Team-member simplified user/plan cards) */}
      {isAdmin ? (
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          {/* Metric Card 1: Selected Month Revenue */}
          <div className="stat-card" style={{ border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">
                  Revenue in {shortMonthNames[selectedMonth]} {selectedYear}
                </div>
                <div className="stat-value" style={{ fontSize: '28px', color: '#10b981', marginTop: '4px' }}>
                  ₹{loading ? "..." : monthlyRevenue.toLocaleString()}
                </div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', color: '#10b981' }}>
                <DollarSign size={24} />
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
              {monthlyGrowth >= 0 ? (
                <>
                  <TrendingUp size={14} style={{ color: '#10b981' }} />
                  <span style={{ color: '#10b981', fontWeight: 600 }}>+{monthlyGrowth}%</span>
                </>
              ) : (
                <>
                  <TrendingDown size={14} style={{ color: '#ef4444' }} />
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>{monthlyGrowth}%</span>
                </>
              )}
              <span style={{ color: '#9ca3af' }}>vs. previous month</span>
            </div>
          </div>

          {/* Metric Card 2: Selected Year Revenue */}
          <div className="stat-card" style={{ border: '1px solid rgba(139, 92, 246, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">Revenue in {selectedYear}</div>
                <div className="stat-value" style={{ fontSize: '28px', color: '#8b5cf6', marginTop: '4px' }}>
                  ₹{loading ? "..." : yearlyRevenue.toLocaleString()}
                </div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', color: '#8b5cf6' }}>
                <DollarSign size={24} />
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#9ca3af' }}>
              <Calendar size={14} />
              <span>Full year performance</span>
            </div>
          </div>

          {/* Metric Card 3: Total Revenue (All Time) */}
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">Total Revenue (All Time)</div>
                <div className="stat-value" style={{ fontSize: '28px', color: 'white', marginTop: '4px' }}>
                  ₹{loading ? "..." : totalRevenue.toLocaleString()}
                </div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', color: '#fff' }}>
                <DollarSign size={24} />
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#9ca3af' }}>
              <TrendingUp size={14} style={{ color: '#10b981' }} />
              <span>Cumulative gross revenue</span>
            </div>
          </div>

          {/* Metric Card 4: Platform Registered DB stats */}
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">Platform Database</div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                  <div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{loading ? "..." : stats.users}</div>
                    <div style={{ fontSize: '10px', color: '#9ca3af' }}>Users</div>
                  </div>
                  <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'white' }}>{loading ? "..." : stats.packages}</div>
                    <div style={{ fontSize: '10px', color: '#9ca3af' }}>Pricing Tiers</div>
                  </div>
                </div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: 'var(--primary)' }}>
                <Users size={24} />
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#9ca3af' }}>
              <Package size={14} />
              <span>Active database counts</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
          {/* Simple Card 1: Registered Users */}
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">Total Registered Users</div>
                <div className="stat-value" style={{ fontSize: '28px', color: 'white', marginTop: '4px' }}>
                  {loading ? "..." : stats.users.toLocaleString()}
                </div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', color: 'var(--primary)' }}>
                <Users size={24} />
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#9ca3af' }}>
              <Calendar size={14} />
              <span>Active customer database</span>
            </div>
          </div>

          {/* Simple Card 2: Subscription Packages */}
          <div className="stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-label">Active Pricing Plans</div>
                <div className="stat-value" style={{ fontSize: '28px', color: '#8b5cf6', marginTop: '4px' }}>
                  {loading ? "..." : stats.packages}
                </div>
              </div>
              <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', color: '#8b5cf6' }}>
                <Package size={24} />
              </div>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#9ca3af' }}>
              <TrendingUp size={14} style={{ color: '#10b981' }} />
              <span>Live subscription tiers</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Row (Trend charts and Package distributions are Admin-only) */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', marginTop: '24px' }}>
          
          {/* Column 1: Sales Trend Chart */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'white', marginBottom: '4px' }}>
                Revenue Trend (Last 6 Months up to {shortMonthNames[selectedMonth]} {selectedYear})
              </h3>
              <p style={{ fontSize: '12px', color: '#9ca3af' }}>Hover on the bars to inspect precise total successful invoice amounts.</p>
            </div>

            {/* Interactive Custom Bar Chart */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-end', 
              justifyContent: 'space-around', 
              height: '240px', 
              padding: '24px 12px 12px', 
              background: '#0e0e0e', 
              borderRadius: '12px', 
              border: '1px solid var(--border)',
              marginTop: '20px',
              position: 'relative'
            }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
                  <div className="loader"></div>
                </div>
              ) : monthlyTrend.length === 0 ? (
                <div style={{ color: '#6b7280', fontSize: '13px' }}>No revenue data recorded</div>
              ) : (
                monthlyTrend.map((t, idx) => {
                  const percent = Math.max(5, Math.round((t.amount / maxTrendAmount) * 100));
                  return (
                    <div key={idx} className="chart-bar-wrapper">
                      <div 
                        className="chart-bar" 
                        style={{ 
                          height: `${percent}%`,
                          width: '36px',
                          background: 'linear-gradient(180deg, #10b981, rgba(16, 185, 129, 0.25))',
                          borderRadius: '6px 6px 0 0',
                          position: 'relative',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <div className="chart-tooltip">
                          ₹{t.amount.toLocaleString()}
                        </div>
                      </div>
                      <span style={{ fontSize: '11px', color: '#9ca3af', marginTop: '8px' }}>{t.monthLabel}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Column 2: Package Distribution Breakdown */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'white' }}>
                Revenue by Plan ({timeframe === "monthly" ? `${shortMonthNames[selectedMonth]} ${selectedYear}` : timeframe === "yearly" ? selectedYear : "All Time"})
              </h3>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  onClick={() => setBreakdownView("visual")}
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: breakdownView === "visual" ? "var(--primary)" : "none",
                    border: '1px solid var(--border)',
                    color: 'white'
                  }}
                >
                  Bars
                </button>
                <button 
                  onClick={() => setBreakdownView("list")}
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: breakdownView === "list" ? "var(--primary)" : "none",
                    border: '1px solid var(--border)',
                    color: 'white'
                  }}
                >
                  List
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
              {loading ? (
                <div className="skeleton" style={{ height: '120px', borderRadius: '8px' }}></div>
              ) : Object.keys(packageBreakdown).length === 0 ? (
                <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px 0' }}>No package sales in this period.</div>
              ) : breakdownView === "visual" ? (
                Object.entries(packageBreakdown).map(([name, val], i) => {
                  const totalPeriodRevenue = Object.values(packageBreakdown).reduce((acc, v) => acc + v, 0);
                  const percentage = Math.round((val / (totalPeriodRevenue || 1)) * 100);
                  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];
                  const color = colors[i % colors.length];
                  
                  return (
                    <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                        <span style={{ color: 'white', fontWeight: 600 }}>{name}</span>
                        <span style={{ color: '#9ca3af' }}>₹{val.toLocaleString()} ({percentage}%)</span>
                      </div>
                      <div style={{ height: '8px', background: '#141414', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${percentage}%`, height: '100%', background: color, borderRadius: '4px', transition: 'width 0.5s ease-out' }}></div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(packageBreakdown).map(([name, val]) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#0e0e0e', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <span style={{ fontWeight: 600 }}>{name}</span>
                      <span style={{ color: '#10b981', fontWeight: 700 }}>₹{val.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Grid: Recent Sales & Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '24px', marginTop: '24px' }}>
        
        {/* Recent Transactions Feed */}
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'white', marginBottom: '16px' }}>Recent Successful Payments</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: '48px', borderRadius: '8px' }}></div>
              ))
            ) : recentSales.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>No successful sales record found.</div>
            ) : (
              recentSales.map((sale) => (
                <div 
                  key={sale.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '12px', 
                    background: '#0e0e0e', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border)' 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      background: 'rgba(16, 185, 129, 0.1)', 
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CreditCard size={14} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'white', fontSize: '13px' }}>
                        {sale.packInfo?.name || "Pro Membership Only"}
                      </div>
                      <div style={{ fontSize: '11px', color: '#9ca3af' }}>{sale.userId}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: '#10b981', fontSize: '14px' }}>+₹{sale.amount}</div>
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>
                      {sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleDateString('en-IN') : ""}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>Administrative Actions</h3>
            <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>Frequently accessed management tools and routes.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {isAdmin && (
              <button 
                className="btn btn-outline" 
                onClick={() => router.push("/coupons")}
                style={{ width: '100%', justifyContent: 'space-between', padding: '12px 16px' }}
              >
                <span>Manage Coupon Discounts</span>
                <ChevronRight size={16} />
              </button>
            )}
            {isAdmin && (
              <button 
                className="btn btn-outline" 
                onClick={() => router.push("/packages")}
                style={{ width: '100%', justifyContent: 'space-between', padding: '12px 16px' }}
              >
                <span>Edit Package Plans</span>
                <ChevronRight size={16} />
              </button>
            )}
            <button 
              className="btn btn-outline" 
              onClick={() => router.push("/users")}
              style={{ width: '100%', justifyContent: 'space-between', padding: '12px 16px' }}
            >
              <span>Review Users & Balances</span>
              <ChevronRight size={16} />
            </button>
            <button 
              className="btn btn-outline" 
              onClick={() => router.push("/ledger")}
              style={{ width: '100%', justifyContent: 'space-between', padding: '12px 16px' }}
            >
              <span>Audit Ledger Log</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .chart-bar:hover .chart-tooltip {
          opacity: 1;
        }
        
        .chart-tooltip {
          position: absolute;
          top: -36px;
          left: 50%;
          transform: translateX(-50%);
          background: #000;
          border: 1px solid var(--border);
          color: #fff;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 700;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s;
          white-space: nowrap;
          box-shadow: 0 4px 6px rgba(0,0,0,0.3);
          z-index: 100;
        }
      `}</style>
    </div>
  );
}
