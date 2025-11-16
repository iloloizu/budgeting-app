'use client'

import { useState, useRef, useEffect } from 'react'
import { PASTEL_PALETTE, getLightTint } from '@/constants/colors'

interface CategoryColorPickerProps {
  color: string | undefined
  onChange: (newColor: string) => void
  categoryName: string
  usedColors?: string[] // Colors already used by other categories
}

export default function CategoryColorPicker({
  color,
  onChange,
  categoryName,
  usedColors = [],
}: CategoryColorPickerProps) {
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false)
      }
    }

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showPicker])

  const currentColor = color || PASTEL_PALETTE[0]
  const lightTint = getLightTint(currentColor, 0.15)

  return (
    <div className="relative inline-block" ref={pickerRef}>
      <div
        className="flex items-center gap-2 cursor-pointer group"
        onMouseEnter={() => setShowPicker(true)}
        onMouseLeave={() => {
          // Delay closing to allow clicking
          setTimeout(() => {
            if (!pickerRef.current?.matches(':hover')) {
              setShowPicker(false)
            }
          }, 200)
        }}
      >
        <div
          className="w-6 h-6 rounded border border-black"
          style={{ backgroundColor: currentColor }}
          title={`Click to change color for ${categoryName}`}
        />
      </div>

      {showPicker && (
        <div
          className="absolute z-50 bg-white border-2 border-black p-4 shadow-lg mt-2"
          style={{ minWidth: '280px', maxHeight: '400px', overflowY: 'auto' }}
          onMouseEnter={() => setShowPicker(true)}
          onMouseLeave={() => setShowPicker(false)}
        >
          <div className="text-xs font-medium text-black mb-3">
            Choose color for {categoryName}
          </div>
          <div className="mb-3">
            <div className="text-xs text-gray-600 mb-1">Light Colors</div>
            <div className="grid grid-cols-5 gap-2">
              {PASTEL_PALETTE.slice(0, 20)
                .filter((paletteColor) => !usedColors.includes(paletteColor) || paletteColor === currentColor)
                .map((paletteColor) => (
                  <button
                    key={paletteColor}
                    onClick={() => {
                      onChange(paletteColor)
                      setShowPicker(false)
                    }}
                    className={`w-8 h-8 rounded border-2 transition-all ${
                      currentColor === paletteColor
                        ? 'border-black scale-110 ring-2 ring-black'
                        : 'border-gray-300 hover:border-black'
                    }`}
                    style={{ backgroundColor: paletteColor }}
                    title={paletteColor}
                  />
                ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-600 mb-1">Darker Colors</div>
            <div className="grid grid-cols-5 gap-2">
              {PASTEL_PALETTE.slice(20)
                .filter((paletteColor) => !usedColors.includes(paletteColor) || paletteColor === currentColor)
                .map((paletteColor) => (
                  <button
                    key={paletteColor}
                    onClick={() => {
                      onChange(paletteColor)
                      setShowPicker(false)
                    }}
                    className={`w-8 h-8 rounded border-2 transition-all ${
                      currentColor === paletteColor
                        ? 'border-black scale-110 ring-2 ring-black'
                        : 'border-gray-300 hover:border-black'
                    }`}
                    style={{ backgroundColor: paletteColor }}
                    title={paletteColor}
                  />
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

