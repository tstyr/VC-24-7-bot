import Link from 'next/link'

export default function Home() {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-center">
        Discord 音楽＆通話記録Bot
      </h1>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            🎵 音楽機能
          </h2>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300">
            <li>✅ 24時間VC滞在</li>
            <li>✅ Lavalink音楽再生</li>
            <li>✅ 検索・選曲機能</li>
            <li>✅ 操作パネル（スキップ、一時停止、リピート）</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4 flex items-center">
            📊 通話記録機能
          </h2>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300">
            <li>✅ VC参加・退出の自動記録</li>
            <li>✅ ユーザー別の履歴管理</li>
            <li>✅ リアルタイムログ保存</li>
            <li>✅ Webダッシュボードで閲覧</li>
          </ul>
        </div>
      </div>

      <div className="mt-8 text-center">
        <Link 
          href="/logs"
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-3 rounded-lg transition shadow-lg"
        >
          通話記録を見る →
        </Link>
      </div>

      <div className="mt-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6">
        <h3 className="text-xl font-semibold mb-3">📝 使い方</h3>
        <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
          <li>Discordサーバーでボイスチャンネルに参加</li>
          <li><code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">/play 曲名</code> で音楽を検索</li>
          <li>検索結果から曲を選択して再生</li>
          <li>操作パネルのボタンで再生をコントロール</li>
          <li>通話記録は自動的にこのダッシュボードに保存されます</li>
        </ol>
      </div>
    </div>
  )
}
