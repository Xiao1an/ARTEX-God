"use client";

import * as React from "react";

import { AlertCircleIcon, CheckCircle2Icon, DownloadIcon, PlugZapIcon, RefreshCwIcon, SearchIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { Collection, FofaRow, SSProject, SSTask } from "@/lib/types";

type SSStatus = {
  exists: boolean;
  configured: boolean;
  enabled: boolean;
  reachable: boolean;
  url?: string;
  tools: string[];
};

type FofaStatus = {
  configured: boolean;
  reachable: boolean;
  email: string;
};

type Dimension = "project" | "task";

const ASSET_TYPES: { key: string; label: string }[] = [
  { key: "subdomain", label: "子域名" },
  { key: "service", label: "服务" },
  { key: "app", label: "App" },
];

export default function AssetSyncPage() {
  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h1 className="font-semibold text-xl">资产同步</h1>
        <p className="text-muted-foreground text-sm">从外部数据源同步资产入库</p>
      </div>
      <Tabs defaultValue="scopesentry">
        <TabsList>
          <TabsTrigger value="scopesentry">ScopeSentry</TabsTrigger>
          <TabsTrigger value="fofa">FOFA</TabsTrigger>
        </TabsList>
        <TabsContent value="scopesentry" className="mt-4">
          <ScopeSentryPanel />
        </TabsContent>
        <TabsContent value="fofa" className="mt-4">
          <FofaPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScopeSentryPanel() {
  const [status, setStatus] = React.useState<SSStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = React.useState(true);

  const loadStatus = React.useCallback(() => {
    setLoadingStatus(true);
    api
      .ssStatus()
      .then(setStatus)
      .catch((e) => toast.error(`读取数据源状态失败：${e.message}`))
      .finally(() => setLoadingStatus(false));
  }, []);

  React.useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const ready = !!status && status.exists && status.configured && status.enabled;

  return (
    <div className="space-y-4">
      <DataSourceCard status={status} loading={loadingStatus} onChanged={loadStatus} />
      {ready ? (
        <SyncWorkbench />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            数据源就绪后即可选择项目 / 任务进行同步。
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── 数据源状态卡 ─────────────────────────────────────────────────────────────

function DataSourceCard({
  status,
  loading,
  onChanged,
}: {
  status: SSStatus | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const [url, setUrl] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (status?.url) setUrl(status.url);
  }, [status?.url]);

  const create = async () => {
    setBusy(true);
    try {
      await api.ssDatasource({});
      toast.success("已创建 ScopeSentry 数据源，请填写地址与密钥");
      onChanged();
    } catch (e) {
      toast.error(`创建失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!url.trim()) return toast.error("请填写 MCP 地址");
    setBusy(true);
    try {
      const r = await api.ssDatasource({ url: url.trim(), api_key: apiKey.trim() });
      toast.success(r.enabled ? "已保存并启用数据源" : "已保存（尚未满足启用条件）");
      setApiKey("");
      onChanged();
    } catch (e) {
      toast.error(`保存失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <PlugZapIcon className="size-4" /> 数据源状态
          <StatusBadge status={status} loading={loading} />
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onChanged} disabled={loading}>
          <RefreshCwIcon className={loading ? "size-4 animate-spin" : "size-4"} /> 刷新
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {!status?.exists ? (
          <div className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              尚未创建 ScopeSentry 数据源。创建后会新增一个占位 MCP（地址/密钥为空、未启用）。
            </p>
            <Button onClick={create} disabled={busy}>
              创建数据源
            </Button>
          </div>
        ) : (
          <>
            {!status.configured && (
              <p className="text-amber-600 text-sm dark:text-amber-500">
                数据源已创建但未配置，请填写 MCP 地址与 API Key 后启用。
              </p>
            )}
            {status.configured && !status.enabled && (
              <p className="text-amber-600 text-sm dark:text-amber-500">数据源已配置但未启用，保存后将自动启用。</p>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>MCP 地址</Label>
                <Input placeholder="http://<主机>:8082/mcp" value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>API Key（X-API-Key，留空保留原值）</Label>
                <Input
                  type="password"
                  placeholder="ssk_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={busy}>
                保存并启用
              </Button>
              {status.enabled && status.tools.length > 0 && (
                <span className="text-muted-foreground text-xs">已发现 {status.tools.length} 个工具</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status, loading }: { status: SSStatus | null; loading: boolean }) {
  if (loading || !status) return <Badge variant="secondary">检测中…</Badge>;
  if (!status.exists) return <Badge variant="destructive">未创建</Badge>;
  if (!status.configured) return <Badge variant="outline">未配置</Badge>;
  if (!status.enabled) return <Badge variant="outline">未启用</Badge>;
  if (status.reachable)
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2Icon className="mr-1 size-3" /> 已连接
      </Badge>
    );
  return (
    <Badge variant="destructive">
      <AlertCircleIcon className="mr-1 size-3" /> 不可达
    </Badge>
  );
}

// ── 同步工作区（项目 / 任务维度）────────────────────────────────────────────────

function SyncWorkbench() {
  const [dimension, setDimension] = React.useState<Dimension>("project");
  const [assetTypes, setAssetTypes] = React.useState<Record<string, boolean>>({
    subdomain: true,
    service: true,
    app: true,
  });
  const [createCompany, setCreateCompany] = React.useState(true);

  const [projects, setProjects] = React.useState<SSProject[]>([]);
  const [tasks, setTasks] = React.useState<SSTask[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const [syncing, setSyncing] = React.useState(false);
  const [result, setResult] = React.useState<Awaited<ReturnType<typeof api.ssSync>> | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    setSelected(new Set());
    const fn =
      dimension === "project"
        ? api.ssProjects(page, 50, search).then((r) => setProjects(r.projects))
        : api.ssTasks(page, 50, search).then(setTasks);
    fn.catch((e) => toast.error(`加载列表失败：${e.message}`)).finally(() => setLoading(false));
  }, [dimension, page, search]);

  React.useEffect(() => {
    load();
  }, [load]);

  const rows = dimension === "project" ? projects : tasks;
  const idOf = (row: SSProject | SSTask) => (dimension === "project" ? (row as SSProject).id : (row as SSTask).name);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map(idOf))));
  };

  const chosenTypes = ASSET_TYPES.filter((t) => assetTypes[t.key]).map((t) => t.key);

  const runSync = async () => {
    if (selected.size === 0) return toast.error(`请至少选择一个${dimension === "project" ? "项目" : "任务"}`);
    if (chosenTypes.length === 0) return toast.error("请至少选择一种资产类型");
    setSyncing(true);
    setResult(null);
    try {
      const r = await api.ssSync({
        dimension,
        targets: [...selected],
        asset_types: chosenTypes,
        create_company: dimension === "project" ? createCompany : false,
      });
      setResult(r);
      const total = Object.values(r.synced ?? {}).reduce((a, b) => a + b, 0);
      toast.success(`同步完成，共入库 ${total} 条资产`);
    } catch (e) {
      toast.error(`同步失败：${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const renderRows = () => {
    if (loading) {
      return (
        <TableRow>
          <TableCell colSpan={4} className="py-8 text-center text-muted-foreground text-sm">
            加载中…
          </TableCell>
        </TableRow>
      );
    }
    if (rows.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={4} className="py-8 text-center text-muted-foreground text-sm">
            无数据
          </TableCell>
        </TableRow>
      );
    }
    if (dimension === "project") {
      return projects.map((p) => (
        <TableRow key={p.id} className="cursor-pointer" onClick={() => toggle(p.id)}>
          <TableCell onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
          </TableCell>
          <TableCell className="font-medium">{p.name}</TableCell>
          <TableCell>{p.tag ? <Badge variant="secondary">{p.tag}</Badge> : "—"}</TableCell>
          <TableCell className="text-right">{p.AssetCount ?? 0}</TableCell>
        </TableRow>
      ));
    }
    return tasks.map((t) => (
      <TableRow key={t.id} className="cursor-pointer" onClick={() => toggle(t.name)}>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(t.name)} onCheckedChange={() => toggle(t.name)} />
        </TableCell>
        <TableCell className="font-medium">{t.name}</TableCell>
        <TableCell>
          <Badge variant={t.progress === 100 ? "secondary" : "outline"}>
            {t.progress != null ? `${t.progress}%` : "—"}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground text-xs">{t.endTime || t.creatTime || "—"}</TableCell>
      </TableRow>
    ));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">选择数据同步</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 维度切换 */}
        <Tabs
          value={dimension}
          onValueChange={(v) => {
            setDimension(v as Dimension);
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="project">项目维度</TabsTrigger>
            <TabsTrigger value="task">任务维度</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* 资产类型 + 选项 */}
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-medium text-sm">同步资产：</span>
          {ASSET_TYPES.map((t) => (
            <label key={t.key} htmlFor={`at-${t.key}`} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                id={`at-${t.key}`}
                checked={!!assetTypes[t.key]}
                onCheckedChange={(c) => setAssetTypes((prev) => ({ ...prev, [t.key]: !!c }))}
              />
              {t.label}
            </label>
          ))}
          {dimension === "project" && (
            <label htmlFor="create-company" className="flex items-center gap-1.5 text-sm">
              <Checkbox id="create-company" checked={createCompany} onCheckedChange={(c) => setCreateCompany(!!c)} />
              按项目建立企业并写入资产范围
            </label>
          )}
        </div>

        {/* 搜索 + 操作 */}
        <div className="flex items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <SearchIcon className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={dimension === "project" ? "搜索项目名" : "搜索任务名"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  load();
                }
              }}
            />
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCwIcon className={loading ? "size-4 animate-spin" : "size-4"} />
          </Button>
          <div className="flex-1" />
          <span className="text-muted-foreground text-xs">已选 {selected.size}</span>
          <Button onClick={runSync} disabled={syncing || selected.size === 0}>
            <DownloadIcon className={syncing ? "size-4 animate-pulse" : "size-4"} /> 同步选中
          </Button>
        </div>

        {/* 列表 */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={rows.length > 0 && selected.size === rows.length} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>{dimension === "project" ? "项目名" : "任务名"}</TableHead>
                {dimension === "project" ? (
                  <>
                    <TableHead>标签</TableHead>
                    <TableHead className="text-right">资产数</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead>状态</TableHead>
                    <TableHead>时间</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>{renderRows()}</TableBody>
          </Table>
        </div>

        {/* 分页 */}
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
            上一页
          </Button>
          <span className="text-muted-foreground text-xs">第 {page} 页</span>
          <Button
            variant="outline"
            size="sm"
            disabled={rows.length < 50 || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>

        {/* 结果 */}
        {result && <SyncResult result={result} />}
      </CardContent>
    </Card>
  );
}

function SyncResult({ result }: { result: Awaited<ReturnType<typeof api.ssSync>> }) {
  const synced = result.synced ?? {};
  const labels: Record<string, string> = { subdomain: "子域名", service: "服务", app: "App", ip: "IP" };
  return (
    <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
      <div className="flex flex-wrap gap-3">
        {Object.entries(synced).map(([k, v]) => (
          <Badge key={k} variant="secondary">
            {labels[k] ?? k}: {v}
          </Badge>
        ))}
      </div>
      {result.companies && result.companies.length > 0 && (
        <p className="text-muted-foreground">新建/更新企业：{result.companies.join("、")}</p>
      )}
      {result.warnings && result.warnings.length > 0 && (
        <ul className="list-inside list-disc text-amber-600 dark:text-amber-500">
          {result.warnings.map((wm) => (
            <li key={wm}>{wm}</li>
          ))}
        </ul>
      )}
      {result.errors && result.errors.length > 0 && (
        <ul className="list-inside list-disc text-destructive">
          {result.errors.slice(0, 20).map((em) => (
            <li key={em}>{em}</li>
          ))}
          {result.errors.length > 20 && <li>…共 {result.errors.length} 条错误</li>}
        </ul>
      )}
    </div>
  );
}

// ── FOFA 数据源 ──────────────────────────────────────────────────────────────

function FofaPanel() {
  const [status, setStatus] = React.useState<FofaStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = React.useState(true);
  const [collectionsReload, setCollectionsReload] = React.useState(0);

  const loadStatus = React.useCallback(() => {
    setLoadingStatus(true);
    api
      .fofaStatus()
      .then(setStatus)
      .catch((e) => toast.error(`读取 FOFA 状态失败：${e.message}`))
      .finally(() => setLoadingStatus(false));
  }, []);

  React.useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  return (
    <div className="space-y-4">
      <FofaDataSourceCard status={status} loading={loadingStatus} onChanged={loadStatus} />
      {status?.configured ? (
        <FofaWorkbench onImported={() => setCollectionsReload((n) => n + 1)} />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            填写并保存 FOFA 账号（Email 可选，API Key 必填）后即可查询并导入资产。
          </CardContent>
        </Card>
      )}
      <FofaCollections reloadKey={collectionsReload} />
    </div>
  );
}

function FofaStatusBadge({ status, loading }: { status: FofaStatus | null; loading: boolean }) {
  if (loading || !status) return <Badge variant="secondary">检测中…</Badge>;
  if (!status.configured) return <Badge variant="outline">未配置</Badge>;
  if (status.reachable)
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2Icon className="mr-1 size-3" /> 已连接
      </Badge>
    );
  return (
    <Badge variant="destructive">
      <AlertCircleIcon className="mr-1 size-3" /> 不可达
    </Badge>
  );
}

function FofaDataSourceCard({
  status,
  loading,
  onChanged,
}: {
  status: FofaStatus | null;
  loading: boolean;
  onChanged: () => void;
}) {
  const [email, setEmail] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (status?.email) setEmail(status.email);
  }, [status?.email]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.fofaDatasource({ email: email.trim(), key: apiKey.trim() });
      toast.success(r.configured ? "已保存 FOFA 账号" : "已保存（尚未填写 API Key）");
      setApiKey("");
      onChanged();
    } catch (e) {
      toast.error(`保存失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <PlugZapIcon className="size-4" /> FOFA 账号
          <FofaStatusBadge status={status} loading={loading} />
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onChanged} disabled={loading}>
          <RefreshCwIcon className={loading ? "size-4 animate-spin" : "size-4"} /> 刷新
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Email（账号，可留空仅用 Key）</Label>
            <Input placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>API Key（留空保留原值）</Label>
            <Input
              type="password"
              placeholder="FOFA API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={busy}>
            保存
          </Button>
          <span className="text-muted-foreground text-xs">
            凭据存于本地数据库，密钥不会回显；FOFA 调用走系统全局代理（若已配置）。
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function FofaWorkbench({ onImported }: { onImported?: () => void }) {
  const [query, setQuery] = React.useState("");
  const [size, setSize] = React.useState("100");
  const [collectionName, setCollectionName] = React.useState("");
  const [previewing, setPreviewing] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [rows, setRows] = React.useState<FofaRow[]>([]);
  const [total, setTotal] = React.useState<number | null>(null);
  const [result, setResult] = React.useState<Awaited<ReturnType<typeof api.fofaSync>> | null>(null);

  const sizeNum = Math.max(1, Math.min(5000, Math.floor(Number(size) || 100)));

  const preview = async () => {
    if (!query.trim()) return toast.error("请填写 FOFA 查询语句");
    setPreviewing(true);
    setResult(null);
    try {
      const r = await api.fofaQuery({ query: query.trim(), size: Math.min(sizeNum, 100) });
      setRows(r.rows);
      setTotal(r.total);
      toast.success(`命中约 ${r.total} 条，预览 ${r.rows.length} 条`);
    } catch (e) {
      toast.error(`查询失败：${(e as Error).message}`);
    } finally {
      setPreviewing(false);
    }
  };

  const runSync = async () => {
    if (!query.trim()) return toast.error("请填写 FOFA 查询语句");
    setSyncing(true);
    setResult(null);
    try {
      const r = await api.fofaSync({
        query: query.trim(),
        size: sizeNum,
        collection_name: collectionName.trim(),
      });
      setResult(r);
      const cname = r.collection?.name || collectionName.trim() || query.trim();
      toast.success(`已导入 ${r.imported ?? 0} 条资产，归入合集「${cname}」`);
      onImported?.();
    } catch (e) {
      toast.error(`导入失败：${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">FOFA 查询与导入</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fofa-query">查询语句（FOFA 语法）</Label>
          <Textarea
            id="fofa-query"
            className="min-h-20 font-mono text-sm"
            placeholder={'domain="example.com"\nip="1.2.3.4/24"\ntitle="后台" && country="CN"'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            用 FOFA 语法检索；预览最多 100 条，导入最多 {sizeNum} 条（上限 5000）。导入的资产会归入一个「合集」，新建任务时可选它为测试目标。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="fofa-size" className="text-sm">
              数量上限
            </Label>
            <Input id="fofa-size" className="w-24" value={size} onChange={(e) => setSize(e.target.value)} />
          </div>
          <div className="flex min-w-60 flex-1 items-center gap-2">
            <Label htmlFor="fofa-collection" className="whitespace-nowrap text-sm">
              合集名
            </Label>
            <Input
              id="fofa-collection"
              placeholder="默认用查询语法命名"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={preview} disabled={previewing || syncing}>
            <SearchIcon className={previewing ? "size-4 animate-pulse" : "size-4"} /> 预览
          </Button>
          <Button onClick={runSync} disabled={syncing || previewing}>
            <DownloadIcon className={syncing ? "size-4 animate-pulse" : "size-4"} /> 导入资产
          </Button>
        </div>

        {rows.length > 0 && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Host</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>端口</TableHead>
                  <TableHead>协议</TableHead>
                  <TableHead>标题</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={`${row.host}-${i}`}>
                    <TableCell className="font-medium">{row.host || "—"}</TableCell>
                    <TableCell>{row.ip || "—"}</TableCell>
                    <TableCell>{row.port || "—"}</TableCell>
                    <TableCell>{row.protocol || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate" title={row.title}>
                      {row.title || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {total != null && (
          <p className="text-muted-foreground text-xs">
            FOFA 命中约 {total} 条（预览展示前 {rows.length} 条）。
          </p>
        )}

        {result && <FofaResult result={result} />}
      </CardContent>
    </Card>
  );
}

function FofaResult({ result }: { result: Awaited<ReturnType<typeof api.fofaSync>> }) {
  const synced = result.synced ?? {};
  const labels: Record<string, string> = { service: "服务", ip: "IP", subdomain: "子域名", domain: "根域名" };
  return (
    <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary">导入 {result.imported ?? 0} 条</Badge>
        {Object.entries(synced).map(([k, v]) => (
          <Badge key={k} variant="outline">
            {labels[k] ?? k}: {v}
          </Badge>
        ))}
        {result.truncated && (
          <Badge variant="outline" className="text-amber-600">
            已达上限截断
          </Badge>
        )}
      </div>
      {result.collection && (
        <p className="text-muted-foreground">
          已归入合集「{result.collection.name}」（{result.collection.members} 个资产）· 新建任务时可在「关联资产合集」里选它为目标
        </p>
      )}
      {result.warnings && result.warnings.length > 0 && (
        <ul className="list-inside list-disc text-amber-600 dark:text-amber-500">
          {result.warnings.map((wm) => (
            <li key={wm}>{wm}</li>
          ))}
        </ul>
      )}
      {result.errors && result.errors.length > 0 && (
        <ul className="list-inside list-disc text-destructive">
          {result.errors.slice(0, 20).map((em) => (
            <li key={em}>{em}</li>
          ))}
          {result.errors.length > 20 && <li>…共 {result.errors.length} 条错误</li>}
        </ul>
      )}
    </div>
  );
}

function FofaCollections({ reloadKey }: { reloadKey: number }) {
  const [cols, setCols] = React.useState<Collection[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    setLoading(true);
    api
      .collections()
      .then(setCols)
      .catch((e) => toast.error(`读取合集失败：${e.message}`))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
  }, [load, reloadKey]);

  const remove = async (c: Collection) => {
    if (!confirm(`删除合集「${c.name}」？仅删除该分组与引用它的任务目标，不删除资产本身。`)) return;
    try {
      await api.deleteCollection(c.id);
      toast.success("已删除合集");
      load();
    } catch (e) {
      toast.error(`删除失败：${(e as Error).message}`);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">资产合集</CardTitle>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCwIcon className={loading ? "size-4 animate-spin" : "size-4"} /> 刷新
        </Button>
      </CardHeader>
      <CardContent>
        {cols.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground text-sm">
            还没有合集。用上方 FOFA 查询并导入后，会生成一个以查询命名的合集，可在新建任务时选为测试目标。
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>查询</TableHead>
                  <TableHead className="text-right">资产数</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cols.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="max-w-xs truncate font-mono text-xs" title={c.query}>
                      {c.query || "—"}
                    </TableCell>
                    <TableCell className="text-right">{c.member_count}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => remove(c)}>
                        删除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
