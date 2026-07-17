import { useEffect, useState } from "react";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey, useGetFundamentalsProviderStatus, getGetFundamentalsProviderStatusQueryKey, useGetBrokerHealth, getGetBrokerHealthQueryKey, SettingsUpdateExecutionMode, type FundamentalsProviderStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";

// Relative-time label for when the live fundamentals provider was last reached,
// falling back to an absolute timestamp for older data.
function fmtFetchedAt(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "unknown";
  const secs = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(t).toLocaleString();
}

// Formats a broker-health dollar figure, honestly showing "—" (never a
// fabricated $0) for a value the check couldn't resolve (e.g. null because
// authentication failed or the platform hasn't been checked yet).
function fmtCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

// Live fundamentals older than the operator-configured threshold (hours) are
// considered stale: the card nudges a refresh instead of just showing the
// timestamp. Falls back to 24h when unset.
const DEFAULT_STALENESS_HOURS = 24;

function isStale(iso: string, stalenessHours: number): boolean {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > stalenessHours * 60 * 60 * 1000;
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useGetSettings();
  const { data: providerStatus } = useGetFundamentalsProviderStatus({
    query: { queryKey: getGetFundamentalsProviderStatusQueryKey(), refetchInterval: 60000 },
  });
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Broker Health is fetched on demand only (the "Check Connection" button),
  // never automatically — mirrors the established enabled:false + manual
  // refetch() pattern used for on-demand data elsewhere in this codebase.
  // GET /api/broker/health always returns 200 (a broker-side failure is an
  // honestly-reported *result*, not a request error) — isError here reflects
  // a genuine failure of THIS platform's own request/response, not Alpaca's.
  const {
    data: brokerHealth,
    isFetching: isCheckingBroker,
    isError: brokerHealthRequestFailed,
    refetch: refetchBrokerHealth,
  } = useGetBrokerHealth({
    query: { queryKey: getGetBrokerHealthQueryKey(), enabled: false },
  });

  const handleCheckConnection = async () => {
    const result = await refetchBrokerHealth();
    if (result.data) {
      // The settings-level alpacaConnected field is computed from this same
      // check server-side (see routes/settings.ts) — invalidate it so a
      // fresh GET /settings (e.g. after a page reload) reflects this check
      // too, even though the panel below already updates immediately from
      // result.data without waiting for this round trip.
      queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
    }
  };

  const [local, setLocal] = useState({
    executionMode: "manual" as SettingsUpdateExecutionMode,
    maxRiskPerTrade: 1,
    maxPortfolioRisk: 10,
    profitTarget50: 50,
    stopLossMultiplier: 2,
    defaultDte: 45,
    shortDelta: 0.20,
    alpacaConnected: false,
    alpacaApiKey: "",
    scannerMode: "mock" as "mock" | "live",
    marketDataProvider: "mock" as "mock" | "alpaca" | "polygon",
    eventRiskEnabled: true,
    eventRiskBlockEarningsShortPremium: true,
    eventRiskAutoBlockHigh: true,
    fundamentalsProvider: "simulated" as "simulated" | "alpha_vantage" | "financial_modeling_prep",
    fundamentalsConnected: false,
    fundamentalsStalenessHours: DEFAULT_STALENESS_HOURS,
    fundamentalsAutoRefresh: true,
    alertsEnabled: true,
  });

  useEffect(() => {
    if (settings) {
      setLocal({
        executionMode: settings.executionMode,
        maxRiskPerTrade: settings.maxRiskPerTrade,
        maxPortfolioRisk: settings.maxPortfolioRisk,
        profitTarget50: settings.profitTarget50,
        stopLossMultiplier: settings.stopLossMultiplier,
        defaultDte: settings.defaultDte || 45,
        shortDelta: settings.shortDelta || 0.20,
        alpacaConnected: settings.alpacaConnected,
        alpacaApiKey: settings.alpacaApiKey || "",
        scannerMode: (settings.scannerMode as "mock" | "live") || "mock",
        marketDataProvider: (settings.marketDataProvider as "mock" | "alpaca" | "polygon") || "mock",
        eventRiskEnabled: settings.eventRiskEnabled ?? true,
        eventRiskBlockEarningsShortPremium: settings.eventRiskBlockEarningsShortPremium ?? true,
        eventRiskAutoBlockHigh: settings.eventRiskAutoBlockHigh ?? true,
        fundamentalsProvider:
          (settings.fundamentalsProvider as "simulated" | "alpha_vantage" | "financial_modeling_prep") ||
          "simulated",
        fundamentalsConnected: settings.fundamentalsConnected ?? false,
        fundamentalsStalenessHours: settings.fundamentalsStalenessHours ?? DEFAULT_STALENESS_HOURS,
        fundamentalsAutoRefresh: settings.fundamentalsAutoRefresh ?? true,
        alertsEnabled: settings.alertsEnabled ?? true,
      });
    }
  }, [settings]);

  // The connection indicator updates immediately from the Broker Health
  // response the moment it resolves — falling back to the settings-loaded
  // value only before any check has been performed this session.
  const brokerConnected = brokerHealth ? brokerHealth.connected : local.alpacaConnected;

  const handleSave = () => {
    updateSettings.mutate(
      { 
        data: {
          executionMode: local.executionMode,
          maxRiskPerTrade: Number(local.maxRiskPerTrade),
          maxPortfolioRisk: Number(local.maxPortfolioRisk),
          profitTarget50: Number(local.profitTarget50),
          stopLossMultiplier: Number(local.stopLossMultiplier),
          defaultDte: Number(local.defaultDte),
          shortDelta: Number(local.shortDelta),
          alpacaApiKey: local.alpacaApiKey || undefined,
          scannerMode: local.scannerMode,
          marketDataProvider: local.marketDataProvider,
          eventRiskEnabled: local.eventRiskEnabled,
          eventRiskBlockEarningsShortPremium: local.eventRiskBlockEarningsShortPremium,
          eventRiskAutoBlockHigh: local.eventRiskAutoBlockHigh,
          fundamentalsProvider: local.fundamentalsProvider,
          fundamentalsStalenessHours: Number(local.fundamentalsStalenessHours),
          fundamentalsAutoRefresh: local.fundamentalsAutoRefresh,
          alertsEnabled: local.alertsEnabled,
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
          toast({ title: "Settings saved" });
        },
        onError: () => {
          toast({ title: "Failed to save settings", variant: "destructive" });
        }
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">System Settings</h1>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Execution Engine</CardTitle>
          <CardDescription>Configure how trades are executed based on scanner signals.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium" id="label-execution-mode">Execution Mode</label>
            <Select value={local.executionMode} onValueChange={(v: any) => setLocal({...local, executionMode: v})}>
              <SelectTrigger className="bg-background" aria-labelledby="label-execution-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (Alert Only)</SelectItem>
                <SelectItem value="semi_auto">Semi-Auto (1-Click Approve)</SelectItem>
                <SelectItem value="full_auto">Full Auto (Unattended)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Full Auto runs unattended — manage guardrails and the master kill switch on the AutoPilot page.</p>
          </div>

          <div className="pt-4 border-t border-border grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="input-max-risk-per-trade">Max Risk Per Trade (%)</label>
              <Input
                id="input-max-risk-per-trade"
                type="number"
                value={local.maxRiskPerTrade}
                onChange={e => setLocal({...local, maxRiskPerTrade: Number(e.target.value)})}
                className="bg-background font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="input-max-portfolio-risk">Max Portfolio Risk (%)</label>
              <Input
                id="input-max-portfolio-risk"
                type="number"
                value={local.maxPortfolioRisk}
                onChange={e => setLocal({...local, maxPortfolioRisk: Number(e.target.value)})}
                className="bg-background font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="input-profit-target">Profit Target (%)</label>
              <Input
                id="input-profit-target"
                type="number"
                value={local.profitTarget50}
                onChange={e => setLocal({...local, profitTarget50: Number(e.target.value)})}
                className="bg-background font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="input-stop-loss-multiplier">Stop Loss Multiplier (xCredit)</label>
              <Input
                id="input-stop-loss-multiplier"
                type="number"
                value={local.stopLossMultiplier}
                onChange={e => setLocal({...local, stopLossMultiplier: Number(e.target.value)})}
                className="bg-background font-mono"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="input-default-dte">Default DTE</label>
              <Input
                id="input-default-dte"
                type="number"
                value={local.defaultDte}
                onChange={e => setLocal({...local, defaultDte: Number(e.target.value)})}
                className="bg-background font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="input-short-delta">Short Delta Target</label>
              <Input
                id="input-short-delta"
                type="number"
                step="0.01"
                value={local.shortDelta}
                onChange={e => setLocal({...local, shortDelta: Number(e.target.value)})}
                className="bg-background font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Market Data</CardTitle>
          <CardDescription>Choose the scanner data source. Live mode pulls real option chains from the selected provider; without provider credentials it falls back to mock data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" id="label-scanner-mode">Scanner Mode</label>
              <Select value={local.scannerMode} onValueChange={(v: any) => setLocal({...local, scannerMode: v})}>
                <SelectTrigger className="bg-background" aria-labelledby="label-scanner-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">Mock (Simulated)</SelectItem>
                  <SelectItem value="live">Live (Provider Chains)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" id="label-data-provider">Data Provider</label>
              <Select value={local.marketDataProvider} onValueChange={(v: any) => setLocal({...local, marketDataProvider: v})}>
                <SelectTrigger className="bg-background" aria-labelledby="label-data-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mock">Mock</SelectItem>
                  <SelectItem value="alpaca">Alpaca</SelectItem>
                  <SelectItem value="polygon">Polygon</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Provider credentials are read from the broker connection or environment. Missing or stale data is automatically rejected and reported in the Market Data Health panel.</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Broker Connection
            <span
              className="text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30"
              data-testid="badge-paper-trading-environment"
            >
              Paper Trading Only
            </span>
          </CardTitle>
          <CardDescription>
            Connects exclusively to Alpaca's Paper Trading environment (<code>paper-api.alpaca.markets</code>).
            This platform never places, modifies, or cancels a live order, and there is no live-trading
            endpoint anywhere in this connection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-background">
            <div>
              <div className="font-medium">Alpaca Paper API</div>
              <div
                className={`text-xs flex items-center gap-1 ${brokerConnected ? 'text-success' : 'text-destructive'}`}
                data-testid="text-broker-connection-status"
              >
                {brokerConnected ? <CheckCircle2 className="w-3 h-3 shrink-0" /> : <XCircle className="w-3 h-3 shrink-0" />}
                {brokerConnected ? 'Connected & Active' : 'Not Connected'}
              </div>
            </div>
            <Switch checked={brokerConnected} disabled />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="input-alpaca-api-key">API Key</label>
            <Input
              id="input-alpaca-api-key"
              type="password"
              placeholder="PK..."
              value={local.alpacaApiKey}
              onChange={e => setLocal({...local, alpacaApiKey: e.target.value})}
              className="bg-background font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The API secret is never stored here — it is read only from the <code>ALPACA_API_SECRET</code>{" "}
              environment variable, and is never displayed or returned by any endpoint.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleCheckConnection}
            disabled={isCheckingBroker}
            data-testid="button-check-broker-connection"
          >
            {isCheckingBroker ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking...
              </>
            ) : (
              "Check Connection"
            )}
          </Button>

          {brokerHealthRequestFailed && (
            <p className="text-xs text-destructive" data-testid="text-broker-health-request-error">
              Could not reach the broker health check endpoint. Try again in a moment.
            </p>
          )}

          {brokerHealth && (
            <div
              className="space-y-3 p-4 border border-border rounded-lg bg-background"
              data-testid="broker-health-results"
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Authentication</div>
                  <div
                    className={brokerHealth.authenticationSuccessful ? "text-success" : "text-destructive"}
                    data-testid="text-broker-auth-status"
                  >
                    {brokerHealth.authenticationSuccessful ? "Successful" : "Failed"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Account Status</div>
                  <div className="font-mono" data-testid="text-broker-account-status">
                    {brokerHealth.accountStatus ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Buying Power</div>
                  <div className="font-mono" data-testid="text-broker-buying-power">
                    {fmtCurrency(brokerHealth.buyingPower)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Cash Balance</div>
                  <div className="font-mono" data-testid="text-broker-cash-balance">
                    {fmtCurrency(brokerHealth.cashBalance)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Portfolio Value</div>
                  <div className="font-mono" data-testid="text-broker-portfolio-value">
                    {fmtCurrency(brokerHealth.portfolioValue)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Open Positions</div>
                  <div className="font-mono" data-testid="text-broker-open-positions">
                    {brokerHealth.openPositionsCount ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Open Orders</div>
                  <div className="font-mono" data-testid="text-broker-open-orders">
                    {brokerHealth.openOrdersCount ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Last Successful Check</div>
                  <div className="font-mono" data-testid="text-broker-last-check">
                    {brokerHealth.lastSuccessfulCheckAt ? fmtFetchedAt(brokerHealth.lastSuccessfulCheckAt) : "Never"}
                  </div>
                </div>
              </div>

              {!brokerHealth.connected && (
                <div className="pt-3 border-t border-border space-y-2">
                  <p
                    className="text-xs text-destructive flex items-start gap-1"
                    data-testid="text-broker-failure-reason"
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" /> {brokerHealth.reason}
                  </p>
                  {brokerHealth.reason.toLowerCase().includes("no alpaca credentials") && (
                    <p className="text-xs text-muted-foreground" data-testid="text-broker-missing-credentials-help">
                      Set the <code>ALPACA_API_KEY</code> and <code>ALPACA_API_SECRET</code> environment
                      variables to connect to your Alpaca Paper Trading account. The API key may also be
                      entered above and saved instead of set via <code>ALPACA_API_KEY</code> — the API
                      secret must always come from the <code>ALPACA_API_SECRET</code> environment variable.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Fundamentals Data
            {local.fundamentalsConnected ? (
              <span className="text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 bg-success/15 text-success border border-success/30">
                Live
              </span>
            ) : (
              <span className="text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30">
                Simulated
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Source for the value-investing research module. Select a provider and add its API key as
            an environment secret (<code>FMP_API_KEY</code> for Financial Modeling Prep,{" "}
            <code>ALPHA_VANTAGE_API_KEY</code> for Alpha Vantage) to fetch real fundamentals. Without a
            key, research uses deterministic SIMULATED data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" id="label-fundamentals-provider">Fundamentals Provider</label>
            <Select
              value={local.fundamentalsProvider}
              onValueChange={(v: any) => setLocal({ ...local, fundamentalsProvider: v })}
            >
              <SelectTrigger className="bg-background" aria-labelledby="label-fundamentals-provider" data-testid="select-fundamentals-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simulated">Simulated (Deterministic)</SelectItem>
                <SelectItem value="alpha_vantage">Alpha Vantage (Live)</SelectItem>
                <SelectItem value="financial_modeling_prep">
                  Financial Modeling Prep (Live)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {local.fundamentalsProvider === "simulated"
                ? "Using built-in simulated fundamentals — labelled SIMULATED everywhere."
                : local.fundamentalsConnected
                  ? "Live provider connected — research fetches real fundamentals (labelled LIVE)."
                  : "Add this provider's API key as an environment secret to connect; until then research falls back to SIMULATED data."}
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="input-fundamentals-staleness-hours">Live Data Staleness Threshold (hours)</label>
            <Input
              id="input-fundamentals-staleness-hours"
              type="number"
              min={1}
              value={local.fundamentalsStalenessHours}
              onChange={(e) =>
                setLocal({ ...local, fundamentalsStalenessHours: Number(e.target.value) })
              }
              className="bg-background font-mono"
              data-testid="input-fundamentals-staleness-hours"
            />
            <p className="text-xs text-muted-foreground">
              Live fundamentals older than this fire the "Stale — refresh recommended" warning on the
              Value Research page and below. Defaults to 24h.
            </p>
          </div>
          <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-background">
            <div>
              <div className="font-medium">Live Fundamentals Connection</div>
              <div
                className={`text-xs ${local.fundamentalsConnected ? "text-success" : "text-muted-foreground"}`}
              >
                {local.fundamentalsConnected ? "Connected & Active" : "Not connected (using simulated data)"}
              </div>
              {local.fundamentalsConnected && (
                <div className="text-[11px] mt-0.5">
                  {settings?.fundamentalsLastFetchedAt ? (
                    isStale(settings.fundamentalsLastFetchedAt, local.fundamentalsStalenessHours) ? (
                      <span
                        className="flex items-center gap-1 font-medium text-amber-400"
                        data-testid="fundamentals-stale"
                      >
                        <AlertTriangle className="w-3 h-3 shrink-0" /> Stale — refresh recommended (last reached {fmtFetchedAt(settings.fundamentalsLastFetchedAt)})
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Provider last reached {fmtFetchedAt(settings.fundamentalsLastFetchedAt)}
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground">
                      Provider not reached yet this session — open Value Research to fetch live data
                    </span>
                  )}
                </div>
              )}
            </div>
            <Switch checked={local.fundamentalsConnected} disabled />
          </div>
          <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-background">
            <div className="pr-4">
              <div className="font-medium">Auto-refresh stale data</div>
              <div className="text-xs text-muted-foreground">
                Automatically re-fetch the coverage universe once live data crosses the staleness
                threshold. Throttled so it never spams the provider. No effect on simulated data.
              </div>
            </div>
            <Switch
              checked={local.fundamentalsAutoRefresh}
              disabled={!local.fundamentalsConnected}
              onCheckedChange={(v) => setLocal({ ...local, fundamentalsAutoRefresh: v })}
              data-testid="switch-fundamentals-auto-refresh"
            />
          </div>
        </CardContent>
      </Card>

      {providerStatus?.statuses && providerStatus.statuses.length > 0 && (
        <Card className="bg-card border-border" data-testid="card-provider-status">
          <CardHeader>
            <CardTitle>Live Provider Status</CardTitle>
            <CardDescription>
              Most recent health of each live fundamentals provider. Rate limits are temporary and
              recover on their own; "unreachable" usually means a missing/invalid key or a provider
              outage. Refreshes automatically every minute.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {providerStatus.statuses.map((s) => (
              <ProviderStatusRow key={s.provider} status={s} />
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Event Risk Filter</CardTitle>
          <CardDescription>Detect earnings, FOMC, CPI, jobs, dividends and other high-impact events. Lowers the Ravish Score in the trade window and enforces hard blocks server-side.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-background">
            <div>
              <div className="font-medium">Enable Event Risk Filter</div>
              <div className="text-xs text-muted-foreground">Master switch — scores and warnings ignore events when off.</div>
            </div>
            <Switch
              checked={local.eventRiskEnabled}
              onCheckedChange={(c) => setLocal({ ...local, eventRiskEnabled: c })}
              data-testid="switch-event-risk-enabled"
            />
          </div>
          <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-background">
            <div>
              <div className="font-medium">Block short premium before earnings</div>
              <div className="text-xs text-muted-foreground">Refuse iron condors / iron flys whose window contains an earnings event.</div>
            </div>
            <Switch
              checked={local.eventRiskBlockEarningsShortPremium}
              onCheckedChange={(c) => setLocal({ ...local, eventRiskBlockEarningsShortPremium: c })}
              disabled={!local.eventRiskEnabled}
              data-testid="switch-event-risk-block-earnings"
            />
          </div>
          <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-background">
            <div>
              <div className="font-medium">Block AutoPilot on high event risk</div>
              <div className="text-xs text-muted-foreground">Halt unattended auto-execution when a candidate's window carries high event risk.</div>
            </div>
            <Switch
              checked={local.eventRiskAutoBlockHigh}
              onCheckedChange={(c) => setLocal({ ...local, eventRiskAutoBlockHigh: c })}
              disabled={!local.eventRiskEnabled}
              data-testid="switch-event-risk-auto-block"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Alerts & Notifications</CardTitle>
          <CardDescription>
            In-app notification center. Reuses your watchlist target-crossing checks (Value Research) and Portfolio
            Risk hard-cap breach detection (Trading Research) as trigger sources — no new detection logic.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-background">
            <div>
              <div className="font-medium">Enable alerts</div>
              <div className="text-xs text-muted-foreground">
                When off, the notification center never generates a new alert for this account.
              </div>
            </div>
            <Switch
              checked={local.alertsEnabled}
              onCheckedChange={(c) => setLocal({ ...local, alertsEnabled: c })}
              data-testid="switch-alerts-enabled"
            />
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave} 
        disabled={updateSettings.isPending}
        className="w-full bg-primary hover:bg-primary/90"
      >
        {updateSettings.isPending ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}

const STATUS_STYLES: Record<
  FundamentalsProviderStatus["state"],
  { label: string; badge: string; dot: string }
> = {
  ok: {
    label: "Operational",
    badge: "bg-success/15 text-success border-success/30",
    dot: "bg-success",
  },
  rate_limited: {
    label: "Rate-limited",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dot: "bg-amber-400",
  },
  unreachable: {
    label: "Unreachable",
    badge: "bg-destructive/15 text-destructive border-destructive/30",
    dot: "bg-destructive",
  },
  no_data: {
    label: "No data",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    dot: "bg-amber-400",
  },
  not_configured: {
    label: "Not configured",
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
  idle: {
    label: "Idle",
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function ProviderStatusRow({ status }: { status: FundamentalsProviderStatus }) {
  const style = STATUS_STYLES[status.state] ?? STATUS_STYLES.idle;
  return (
    <div
      className="p-4 border border-border rounded-lg bg-background space-y-2"
      data-testid={`provider-status-${status.provider}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
          <span className="font-medium">{status.label}</span>
          {status.selected && (
            <span className="text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 bg-primary/15 text-primary border border-primary/30">
              Selected
            </span>
          )}
        </div>
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 border ${style.badge}`}
          data-testid={`provider-status-badge-${status.provider}`}
        >
          {style.label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{status.message}</p>
      {(status.lastSuccessAt || status.lastFallbackAt) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground/80 font-mono">
          {status.lastSuccessAt && <span>Last OK: {formatTimestamp(status.lastSuccessAt)}</span>}
          {status.lastFallbackAt && (
            <span>Last fallback: {formatTimestamp(status.lastFallbackAt)}</span>
          )}
        </div>
      )}
    </div>
  );
}
