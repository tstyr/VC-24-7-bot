import LogsTable from '@/components/LogsTable';

export default function LogsPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">📊 通話記録</h1>
        <p className="text-gray-600 dark:text-gray-400">
          ボイスチャンネルの参加・退出履歴を確認できます
        </p>
      </div>

      <LogsTable />
    </div>
  );
}
