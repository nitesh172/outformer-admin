"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Users, Package, TrendingUp, TrendingDown, DollarSign, Calendar, RefreshCcw, CreditCard } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { CustomSelect } from "@/components/ui/CustomSelect";


export default function Dashboard() {
    const { isAdmin } = useAuth();
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

    const [usersMap, setUsersMap] = useState<Record<string, { email: string; displayName: string }>>({});
    const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);

    async function fetchDashboardData() {
        setLoading(true);
        try {
            setError(null);

            // 1. Fetch Users & Packages counts
            const userSnap = await getDocs(collection(db, "users"));
            const packageSnap = await getDocs(collection(db, "packages"));

            const cache: Record<string, { email: string; displayName: string }> = {};
            userSnap.docs.forEach(doc => {
                cache[doc.id] = {
                    email: doc.data().email || "",
                    displayName: doc.data().displayName || ""
                };
            });
            setUsersMap(cache);

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
                .filter((p: any) => p.status?.toUpperCase() === 'SUCCESS');

            setPaymentsList(successPayments);

        } catch (error: any) {
            console.warn("Error fetching dashboard data:", error?.message || error);
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
                    borderRadius: '0px',
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
                    justifyContent: 'flex-end',
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border)',
                    borderRadius: '0px',
                    padding: '12px 20px',
                    marginBottom: '24px',
                    gap: '24px',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px' }}>
                        <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap' }}>Breakdown View:</span>
                        <CustomSelect
                            value={timeframe}
                            onChange={(val) => setTimeframe(val as any)}
                            options={[
                                { value: "monthly", label: "Selected Month" },
                                { value: "yearly", label: "Selected Year" },
                                { value: "total", label: "All Time" }
                            ]}
                        />
                    </div>

                    {timeframe === "monthly" && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px' }}>
                            <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap' }}>Month:</span>
                            <CustomSelect
                                value={String(selectedMonth)}
                                onChange={(val) => setSelectedMonth(Number(val))}
                                options={monthNames.map((name, idx) => ({ value: String(idx), label: name }))}
                            />
                        </div>
                    )}

                    {(timeframe === "monthly" || timeframe === "yearly") && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '140px' }}>
                            <span style={{ fontSize: '13px', color: '#9ca3af', fontWeight: 600, whiteSpace: 'nowrap' }}>Year:</span>
                            <CustomSelect
                                value={String(selectedYear)}
                                onChange={(val) => setSelectedYear(Number(val))}
                                options={availableYears.map(yr => ({ value: String(yr), label: String(yr) }))}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Grid: Performance Metrics (Admin-only detailed cards vs Team-member simplified user/plan cards) */}
            {isAdmin ? (
                <div className="stats-grid">
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
                            <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0px', color: '#10b981' }}>
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
                            <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '0px', color: '#8b5cf6' }}>
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
                                <div className="stat-value" style={{ fontSize: '28px', color: 'var(--foreground)', marginTop: '4px' }}>
                                    ₹{loading ? "..." : totalRevenue.toLocaleString()}
                                </div>
                            </div>
                            <div style={{ padding: '12px', background: 'var(--muted)', borderRadius: '0px', color: 'var(--foreground)' }}>
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
                                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--foreground)' }}>{loading ? "..." : stats.users}</div>
                                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>Users</div>
                                    </div>
                                    <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--foreground)' }}>{loading ? "..." : stats.packages}</div>
                                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>Pricing Tiers</div>
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '0px', color: 'var(--primary)' }}>
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
                <div className="stats-grid">
                    {/* Simple Card 1: Registered Users */}
                    <div className="stat-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <div className="stat-label">Total Registered Users</div>
                                <div className="stat-value" style={{ fontSize: '28px', color: 'var(--foreground)', marginTop: '4px' }}>
                                    {loading ? "..." : stats.users.toLocaleString()}
                                </div>
                            </div>
                            <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '0px', color: 'var(--primary)' }}>
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
                            <div style={{ padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '0px', color: '#8b5cf6' }}>
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
                <div className="two-col-grid" style={{ marginTop: '20px', gap: '24px' }}>

                    {/* Column 1: Sales Trend Chart */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', margin: 0 }}>
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--foreground)', marginBottom: '4px' }}>
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
                            background: 'var(--muted)',
                            borderRadius: '0px',
                            border: '1px solid var(--border)',
                            marginTop: '20px',
                            position: 'relative'
                        }}>
                            {loading ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
                                    <div className="loader"></div>
                                </div>
                            ) : paymentsList.length === 0 ? (
                                <div style={{ color: '#6b7280', fontSize: '13px' }}>No revenue data recorded</div>
                            ) : (
                                monthlyTrend.map((t, idx) => {
                                    const percent = Math.max(5, Math.round((t.amount / maxTrendAmount) * 100));
                                    return (
                                        <div key={idx} className="chart-bar-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                                            <div
                                                className="chart-bar"
                                                style={{
                                                    height: `${percent}%`,
                                                    width: '36px',
                                                    background: 'linear-gradient(180deg, #10b981, rgba(16, 185, 129, 0.25))',
                                                    borderRadius: '0px',
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
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', margin: 0 }}>
                        <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--foreground)', marginBottom: '4px' }}>
                                Revenue by Plan ({timeframe === "monthly" ? `${shortMonthNames[selectedMonth]} ${selectedYear}` : timeframe === "yearly" ? selectedYear : "All Time"})
                            </h3>
                            <p style={{ fontSize: '12px', color: '#9ca3af' }}>Breakdown of package revenue distribution for the selected period.</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: '20px', width: '100%' }}>
                            {loading ? (
                                <div className="skeleton" style={{ height: '120px', borderRadius: '0px', width: '100%' }}></div>
                            ) : Object.keys(packageBreakdown).length === 0 ? (
                                <div style={{ textAlign: 'center', color: '#6b7280', padding: '40px 0', width: '100%' }}>No package sales in this period.</div>
                            ) : (
                                (() => {
                                    const totalPeriodRevenue = Object.values(packageBreakdown).reduce((acc, v) => acc + v, 0);
                                    const radius = 65;
                                    const strokeWidth = 16;
                                    const circumference = 2 * Math.PI * radius;
                                    const center = 75;
                                    const svgSize = center * 2;

                                    const gradientColors = [
                                        { from: "#3b82f6", to: "#60a5fa" }, // Blue
                                        { from: "#8b5cf6", to: "#c084fc" }, // Purple
                                        { from: "#10b981", to: "#34d399" }, // Emerald
                                        { from: "#f59e0b", to: "#fbbf24" }, // Amber
                                        { from: "#f43f5e", to: "#fb7185" }, // Rose
                                    ];

                                    let accumulatedPercent = 0;

                                    return (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '100%' }}>
                                            <div style={{ position: 'relative', width: svgSize, height: svgSize }}>
                                                <svg width={svgSize} height={svgSize} style={{ transform: 'rotate(-90deg)' }}>
                                                    <defs>
                                                        {Object.keys(packageBreakdown).map((_, idx) => {
                                                            const colors = gradientColors[idx % gradientColors.length];
                                                            return (
                                                                <linearGradient key={idx} id={`pie-grad-${idx}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                                                    <stop offset="0%" stopColor={colors.from} />
                                                                    <stop offset="100%" stopColor={colors.to} />
                                                                </linearGradient>
                                                            );
                                                        })}
                                                    </defs>
                                                    {/* Background Track */}
                                                    <circle
                                                        cx={center}
                                                        cy={center}
                                                        r={radius}
                                                        fill="transparent"
                                                        stroke="var(--muted)"
                                                        strokeWidth={strokeWidth}
                                                    />
                                                    {/* Slices */}
                                                    {Object.entries(packageBreakdown).map(([name, val], idx) => {
                                                        const percent = val / (totalPeriodRevenue || 1);
                                                        const strokeDasharray = `${percent * circumference} ${circumference}`;
                                                        const strokeDashoffset = -accumulatedPercent * circumference;
                                                        accumulatedPercent += percent;
                                                        const isHovered = hoveredSlice === idx;

                                                        return (
                                                            <circle
                                                                key={name}
                                                                cx={center}
                                                                cy={center}
                                                                r={radius}
                                                                fill="transparent"
                                                                stroke={`url(#pie-grad-${idx})`}
                                                                strokeWidth={isHovered ? strokeWidth + 2 : strokeWidth}
                                                                strokeDasharray={strokeDasharray}
                                                                strokeDashoffset={strokeDashoffset}
                                                                strokeLinecap="round"
                                                                style={{
                                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                                    cursor: 'pointer',
                                                                }}
                                                                onMouseEnter={() => setHoveredSlice(idx)}
                                                                onMouseLeave={() => setHoveredSlice(null)}
                                                            />
                                                        );
                                                    })}
                                                </svg>
                                                
                                                {/* Text in the Center of Donut */}
                                                <div style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    height: '100%',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    pointerEvents: 'none',
                                                    textAlign: 'center',
                                                    padding: '10px'
                                                }}>
                                                    {(() => {
                                                        const entries = Object.entries(packageBreakdown);
                                                        const activeEntry = hoveredSlice !== null ? entries[hoveredSlice] : null;
                                                        if (activeEntry) {
                                                            const [name, val] = activeEntry;
                                                            const percentage = Math.round((val / (totalPeriodRevenue || 1)) * 100);
                                                            return (
                                                                <>
                                                                    <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                        {name.length > 12 ? name.substring(0, 12) + "..." : name}
                                                                    </span>
                                                                    <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--foreground)', margin: '1px 0' }}>
                                                                        ₹{val.toLocaleString()}
                                                                    </span>
                                                                    <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                                                                        {percentage}%
                                                                    </span>
                                                                </>
                                                            );
                                                        } else {
                                                            return (
                                                                <>
                                                                    <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                                        Total
                                                                    </span>
                                                                    <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--foreground)', margin: '1px 0' }}>
                                                                        ₹{totalPeriodRevenue.toLocaleString()}
                                                                    </span>
                                                                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                                                                        Revenue
                                                                    </span>
                                                                </>
                                                            );
                                                        }
                                                    })()}
                                                </div>
                                            </div>

                                            {/* Custom legend indicators */}
                                            <div style={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: '8px',
                                                justifyContent: 'center',
                                                width: '100%'
                                            }}>
                                                {Object.entries(packageBreakdown).map(([name, val], idx) => {
                                                    const percentage = Math.round((val / (totalPeriodRevenue || 1)) * 100);
                                                    const colors = gradientColors[idx % gradientColors.length];
                                                    const isHovered = hoveredSlice === idx;
                                                    return (
                                                        <div
                                                            key={name}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                padding: '4px 8px',
                                                                background: isHovered ? 'var(--muted)' : 'transparent',
                                                                borderRadius: '6px',
                                                                border: isHovered ? '1px solid var(--border)' : '1px solid transparent',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s'
                                                            }}
                                                            onMouseEnter={() => setHoveredSlice(idx)}
                                                            onMouseLeave={() => setHoveredSlice(null)}
                                                        >
                                                            <div style={{
                                                                width: '8px',
                                                                height: '8px',
                                                                borderRadius: '50%',
                                                                background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`
                                                            }} />
                                                            <span style={{ fontSize: '11px', fontWeight: isHovered ? 700 : 500, color: 'var(--foreground)' }}>
                                                                {name}: {percentage}%
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Grid: Recent Sales & Quick Actions */}
            <div style={{ marginTop: '24px' }}>

                {/* Recent Transactions Feed */}
                <div className="card" style={{ margin: 0 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--foreground)', marginBottom: '16px' }}>Recent Successful Payments</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {loading ? (
                            [...Array(3)].map((_, i) => (
                                <div key={i} className="skeleton" style={{ height: '48px', borderRadius: '0px' }}></div>
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
                                        background: 'var(--muted)',
                                        borderRadius: '0px',
                                        border: '1px solid var(--border)'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '32px',
                                            height: '32px',
                                            borderRadius: '0px',
                                            background: 'rgba(16, 185, 129, 0.1)',
                                            color: '#10b981',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <CreditCard size={14} />
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--foreground)', fontSize: '13px' }}>
                                                {sale.packInfo?.name || "Pro Membership Only"}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#9ca3af' }}>
                                                {usersMap[sale.userId]?.displayName || usersMap[sale.userId]?.email || sale.userId}
                                            </div>
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
          background: var(--popover);
          border: 1px solid var(--border);
          color: var(--popover-foreground);
          padding: 4px 8px;
          border-radius: 0px;
          font-size: 11px;
          font-weight: 700;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s;
          white-space: nowrap;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          z-index: 100;
        }
      `}</style>
        </div>
    );
}
