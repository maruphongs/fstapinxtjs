import Image from "next/image";

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center p-12">
            <Image className="select-none" src="/images/njsfapi.webp" alt="NextJS + FastAPI" width={400} height={400} />
            <h1 className="text-3xl mt-6 flex items-center">
                <Image className="select-none" src="/images/njs.webp" alt="NextJS" width={100} height={100} />
                <span className="mx-2">+</span>
                <Image className="select-none" src="/images/fapi.webp" alt="FastAPI" width={100} height={100} />
                </h1>
        </main>
    );
}
