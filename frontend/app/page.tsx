"use client";

import { useState } from "react";
import Image from "next/image";
import { API_URL } from "./lib/auth";

export default function Home() {
    const [corsTesting, setCorsTesting] = useState(false);
    const [corsResult, setCorsResult] = useState<string | null>(null);

    async function testCors() {
        setCorsTesting(true);
        setCorsResult(null);
        try {
            const response = await fetch(`${API_URL}/foo`, {
                method: "HEAD",
                headers: { "X-CORS-Test": "true" },
            });
            setCorsResult(`Unexpectedly received HTTP ${response.status}; HEAD was allowed by CORS.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            setCorsResult(`Browser request failed: ${message}. If the API is running, this is the expected CORS rejection.`);
        } finally {
            setCorsTesting(false);
        }
    }

    return (
        <main className="flex min-h-screen flex-col items-center p-12 bg-black bg-[radial-gradient(circle_at_center,#000_0,transparent_10%),linear-gradient(to_right,#039587_1px,transparent_1px),linear-gradient(to_bottom,#039587_1px,transparent_1px)] bg-size-[auto,40px_40px,40px_40px]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-linear-to-b from-black to-black/25" />
            <div className="relative z-10 perspective-midrange flex flex-col items-center gap-6 text-teal-500">
                <div className="pointer-events-none select-none animate-spin-3d relative h-120 w-120 transform-3d mt-6">
                    <Image className="absolute inset-0" src="/images/njsfapi.webp" alt="NextJS + FastAPI" width={500} height={500} />
                    <Image className="animate-float-spin absolute top-50 right-0 w-15" src="/images/mymomiskinda.png" alt="emoji" width={500} height={500} />
                </div>
                
                <h1 className="text-3xl mt-6 flex items-center">
                    <Image className="pointer-events-none select-none invert" src="/images/njs.webp" alt="NextJS" width={100} height={100} />
                    <span className="mx-2">+</span>
                    <Image className="pointer-events-none select-none" src="/images/fapi.webp" alt="FastAPI" width={100} height={100} />
                </h1>

                <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
                    <a
                        href="/graphql"
                        className="rounded-full bg-teal-500/20 border border-teal-500/50 px-6 py-2.5 text-sm font-bold text-teal-300 shadow-lg shadow-teal-500/20 transition hover:bg-teal-500/30 hover:scale-105"
                    >
                        Explore GraphQL CRUD Studio →
                    </a>
                    <button
                        type="button"
                        onClick={testCors}
                        disabled={corsTesting}
                        className="rounded-full border border-rose-400/60 bg-rose-500/15 px-6 py-2.5 text-sm font-bold text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-60"
                    >
                        {corsTesting ? "Testing..." : "Test CORS"}
                    </button>
                </div>
                {corsResult && (
                    <p role="status" aria-live="polite" className="max-w-xl text-center text-sm text-rose-200">
                        {corsResult}
                    </p>
                )}
            </div>
        </main>
    );
}
