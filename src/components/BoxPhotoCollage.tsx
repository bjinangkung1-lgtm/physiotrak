import React from 'react';
import { Image as ImageIcon, ZoomIn, Plus, SlidersHorizontal } from 'lucide-react';
import { QueueBox } from '../types';
import { getBoxImageUrls, handleImageErrorWithCloudFallback } from '../utils/imageUtils';

interface BoxPhotoCollageProps {
  box: QueueBox;
  onOpenGallery: (initialIndex?: number, initialTab?: 'viewer' | 'manage' | 'database') => void;
  className?: string;
}

export const BoxPhotoCollage: React.FC<BoxPhotoCollageProps> = React.memo(({
  box,
  onOpenGallery,
  className = '',
}) => {
  const images = getBoxImageUrls(box);
  const count = images.length;

  if (count === 0) {
    return null;
  }

  // Common fallback image
  const fallbackImg = 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=600&q=80';

  return (
    <div className={`relative w-full overflow-hidden bg-slate-900 border-b border-slate-200/70 group/img ${className}`}>
      {/* 1 PHOTO LAYOUT */}
      {count === 1 && (
        <div 
          className="relative h-32 w-full cursor-pointer overflow-hidden bg-slate-950"
          onClick={() => onOpenGallery(0, 'viewer')}
        >
          <img
            src={images[0]}
            alt={`Foto instruksi ${box.title}`}
            className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity duration-200"
            onError={(e) => handleImageErrorWithCloudFallback(e, fallbackImg)}
          />
        </div>
      )}

      {/* 2 PHOTOS LAYOUT (2-Column split) */}
      {count === 2 && (
        <div className="grid grid-cols-2 gap-1 h-32 bg-slate-950 p-1">
          {images.map((img, idx) => (
            <div
              key={idx}
              className="relative h-full overflow-hidden rounded-md cursor-pointer group/tile"
              onClick={() => onOpenGallery(idx, 'viewer')}
            >
              <img
                src={img}
                alt={`Foto ${idx + 1} ${box.title}`}
                className="w-full h-full object-cover opacity-90 group-hover/tile:opacity-100 transition-opacity duration-200"
                onError={(e) => handleImageErrorWithCloudFallback(e, fallbackImg)}
              />
              <div className="absolute top-1 left-1 bg-black/75 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                #{idx + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3 PHOTOS LAYOUT (1 Prominent Left + 2 Stacked Right) */}
      {count === 3 && (
        <div className="grid grid-cols-3 gap-1 h-34 bg-slate-950 p-1">
          {/* Main Left Tile (2 cols) */}
          <div
            className="col-span-2 relative h-full overflow-hidden rounded-md cursor-pointer group/tile"
            onClick={() => onOpenGallery(0, 'viewer')}
          >
            <img
              src={images[0]}
              alt={`Foto 1 ${box.title}`}
              className="w-full h-full object-cover opacity-90 group-hover/tile:opacity-100 transition-opacity duration-200"
              onError={(e) => handleImageErrorWithCloudFallback(e, fallbackImg)}
            />
            <div className="absolute top-1 left-1 bg-black/75 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded">
              #1 Utama
            </div>
          </div>
          {/* Stacked Right Tiles (1 col, 2 rows) */}
          <div className="flex flex-col gap-1 h-full">
            {images.slice(1, 3).map((img, idx) => {
              const realIndex = idx + 1;
              return (
                <div
                  key={realIndex}
                  className="relative flex-1 overflow-hidden rounded-md cursor-pointer group/tile"
                  onClick={() => onOpenGallery(realIndex, 'viewer')}
                >
                  <img
                    src={img}
                    alt={`Foto ${realIndex + 1} ${box.title}`}
                    className="w-full h-full object-cover opacity-90 group-hover/tile:opacity-100 transition-opacity duration-200"
                    onError={(e) => handleImageErrorWithCloudFallback(e, fallbackImg)}
                  />
                  <div className="absolute top-1 left-1 bg-black/75 text-white text-[8px] font-bold px-1 py-0.2 rounded">
                    #{realIndex + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4+ PHOTOS LAYOUT (2x2 Collage with +N Overlay for 5+) */}
      {count >= 4 && (
        <div className="grid grid-cols-2 gap-1 h-36 bg-slate-950 p-1">
          {images.slice(0, 4).map((img, idx) => {
            const isLastOfFour = idx === 3;
            const remainingCount = count - 4;

            return (
              <div
                key={idx}
                className="relative h-full overflow-hidden rounded-md cursor-pointer group/tile"
                onClick={() => onOpenGallery(idx, 'viewer')}
              >
                <img
                  src={img}
                  alt={`Foto ${idx + 1} ${box.title}`}
                  className="w-full h-full object-cover opacity-90 group-hover/tile:opacity-100 transition-opacity duration-200"
                  onError={(e) => handleImageErrorWithCloudFallback(e, fallbackImg)}
                />
                
                {/* +N Badge on the 4th item if total > 4 */}
                {isLastOfFour && remainingCount > 0 ? (
                  <div className="absolute inset-0 bg-slate-950/85 flex flex-col items-center justify-center text-white p-1 text-center group-hover/tile:bg-slate-950/90 transition-colors">
                    <span className="font-black text-sm text-amber-300 drop-shadow-sm">+{remainingCount + 1}</span>
                    <span className="text-[8px] font-extrabold uppercase tracking-tight text-white/90">Foto Lainnya</span>
                  </div>
                ) : (
                  <div className="absolute top-1 left-1 bg-black/75 text-white text-[8px] font-bold px-1 py-0.2 rounded">
                    #{idx + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Gradient Overlay Info */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between p-2 pointer-events-none z-10">
        <span className="text-[10px] font-extrabold text-white/95 drop-shadow-xs flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
          <span>{count} Foto Tersimpan</span>
        </span>
        <span className="text-[9px] font-bold text-amber-200/90 bg-black/60 px-1.5 py-0.5 rounded">
          Klik untuk Perbesar
        </span>
      </div>

      {/* Top Floating Action Buttons (Revealed on hover) */}
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity z-20">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenGallery(0, 'viewer');
          }}
          className="bg-black/80 hover:bg-black text-white p-1.5 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-md"
          title="Perbesar Galeri Foto"
        >
          <ZoomIn className="w-3.5 h-3.5 text-amber-300" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenGallery(0, 'manage');
          }}
          className="bg-blue-600/90 hover:bg-blue-600 text-white p-1.5 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-md"
          title="Tambah / Upload Foto Lagi"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenGallery(0, 'manage');
          }}
          className="bg-slate-800/90 hover:bg-slate-900 text-white p-1.5 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer shadow-md"
          title="Kelola & Atur Urutan Foto"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-teal-300" />
        </button>
      </div>
    </div>
  );
});
