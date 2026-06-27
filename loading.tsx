import Image from "next/image";

export default function Loading() {
  return (
    <div className='fixed inset-0 z-50 flex flex-col items-center justify-center bg-white'>
      <div className='flex flex-col items-center gap-6'>
        <div className='relative animate-pulse'>
          <Image
            src='/logo.webp'
            alt='NFVCB Logo'
            width={120}
            height={120}
            className='object-contain'
            priority
          />
        </div>

        <div className='flex flex-col items-center gap-3'>
          <div className='flex gap-1.5'>
            <span
              className='h-2.5 w-2.5 rounded-full bg-green-700 animate-bounce'
              style={{ animationDelay: "0ms" }}
            />
            <span
              className='h-2.5 w-2.5 rounded-full bg-green-700 animate-bounce'
              style={{ animationDelay: "150ms" }}
            />
            <span
              className='h-2.5 w-2.5 rounded-full bg-green-700 animate-bounce'
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <p className='text-sm font-medium tracking-widest text-green-800 uppercase'>
            Loading...
          </p>
        </div>
      </div>
    </div>
  );
}
