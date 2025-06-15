'use client'

import {useEffect, useState, useCallback} from 'react'

type LogEntry = {
	id: number
	service: string
	level: string
	message: string
	timestamp: string
}

export default function Home() {
	const [logs, setLogs] = useState<LogEntry[]>([])
	const [loading, setLoading] = useState(false)
	const [serviceFilter, setServiceFilter] = useState('')
	const [levelFilter, setLevelFilter] = useState('')

	const fetchLogs = async () => {
		setLoading(true)
		const params = new URLSearchParams()
		if (serviceFilter) params.append('service', serviceFilter)
		if (levelFilter) params.append('level', levelFilter)

		const apiBase = ''
		const res = await fetch(`${apiBase}/logs?${params.toString()}`)
		const data = await res.json()
		setLogs(data)
		setLoading(false)
	}

	// useCallback to avoid missing dependency warning
	const fetchLogsCallback = useCallback(fetchLogs, [
		serviceFilter,
		levelFilter,
	])

	useEffect(() => {
		fetchLogsCallback()
	}, [fetchLogsCallback])

	return (
		<main className="p-6">
			<h1 className="text-2xl font-bold mb-4">
				SentryEdge – Log Dashboard
			</h1>

			<div className="flex gap-4 mb-4">
				<input
					type="text"
					placeholder="Filter by service"
					value={serviceFilter}
					onChange={e => setServiceFilter(e.target.value)}
					className="border px-2 py-1 rounded"
				/>
				<input
					type="text"
					placeholder="Filter by level"
					value={levelFilter}
					onChange={e => setLevelFilter(e.target.value)}
					className="border px-2 py-1 rounded"
				/>
			</div>

			{loading ? (
				<p>Loading...</p>
			) : (
				<table className="w-full border border-gray-300 text-sm">
					<thead>
						<tr className="bg-gray-100 text-left">
							<th className="p-2">Time</th>
							<th className="p-2">Service</th>
							<th className="p-2">Level</th>
							<th className="p-2">Message</th>
						</tr>
					</thead>
					<tbody>
						{logs.map(log => (
							<tr key={log.id} className="border-t">
								<td className="p-2">
									{new Date(log.timestamp).toLocaleString()}
								</td>
								<td className="p-2">{log.service}</td>
								<td className="p-2">{log.level}</td>
								<td className="p-2">{log.message}</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</main>
	)
}
