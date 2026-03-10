export default function HomePage() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-8">
            <div className="text-center">
                <h1 className="text-4xl font-bold tracking-tight text-sky-900">
                    Elder-Guard AI
                </h1>
                <p className="mt-4 text-lg text-slate-500">
                    Guardian Dashboard — Week 1 Scaffold
                </p>
                <div className="mt-8 flex gap-4 justify-center">
                    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-slate-800">Monitoring</h2>
                        <p className="mt-2 text-sm text-slate-500">
                            Real-time sensor data from connected devices
                        </p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-xl font-semibold text-slate-800">Alerts</h2>
                        <p className="mt-2 text-sm text-slate-500">
                            Anomaly detection and instant notifications
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
