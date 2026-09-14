import Image from "next/image";

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center p-12 bg-black bg-[radial-gradient(circle_at_center,#000_0,transparent_10%),linear-gradient(to_right,#039587_1px,transparent_1px),linear-gradient(to_bottom,#039587_1px,transparent_1px)] bg-size-[auto,40px_40px,40px_40px]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-full bg-linear-to-b from-black to-transparent" />
            <div className="relative z-10 perspective-midrange flex flex-col items-center gap-6 text-white">
                <div className="pointer-events-none select-none animate-spin-3d relative h-120 w-120 transform-3d">
                    <Image className="absolute inset-0" src="/images/njsfapi.webp" alt="NextJS + FastAPI" width={500} height={500} />
                    <Image className="animate-spin-3d absolute top-10 right-0 w-15 origin-right" src="/images/mymomiskinda.png" alt="emoji" width={500} height={500} />
                </div>
                
                <h1 className="text-3xl mt-6 flex items-center">
                    <Image className="pointer-events-none select-none invert" src="/images/njs.webp" alt="NextJS" width={100} height={100} />
                    <span className="mx-2">+</span>
                    <Image className="pointer-events-none select-none" src="/images/fapi.webp" alt="FastAPI" width={100} height={100} />
                </h1>
            </div>
        </main>
    );
}
