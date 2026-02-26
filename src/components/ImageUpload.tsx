import { useState, useRef, useCallback } from 'react'

interface ImageUploadProps {
  onFileSelect: (file: File) => void
  currentFile?: File | null
  existingUrl?: string | null
  label?: string
}

export function ImageUpload({
  onFileSelect,
  currentFile,
  existingUrl,
  label = 'Shot Image',
}: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File) => {
      onFileSelect(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    },
    [onFileSelect]
  )

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) {
      handleFile(file)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  const displayUrl = previewUrl ?? existingUrl

  return (
    <div>
      <label className="text-sm text-on-surface-secondary block mb-1">
        {label}
      </label>

      {/* Preview */}
      {displayUrl && (
        <div className="mb-2 relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
          <img
            src={displayUrl}
            alt="Preview"
            className="w-full h-full object-contain"
          />
          <button
            type="button"
            onClick={() => {
              setPreviewUrl(null)
              if (inputRef.current) inputRef.current.value = ''
              onFileSelect(null as unknown as File)
            }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center text-sm hover:bg-black/80 transition-colors"
          >
            ✕
          </button>
          {currentFile && (
            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-xs px-3 py-1.5 truncate">
              {currentFile.name}
            </div>
          )}
        </div>
      )}

      {/* Drop zone */}
      {!displayUrl && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragActive
              ? 'border-accent bg-accent/5'
              : 'border-border hover:border-accent/50 hover:bg-surface-secondary'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-on-surface">
                {dragActive ? 'Drop image here' : 'Tap to upload or drag & drop'}
              </p>
              <p className="text-xs text-on-surface-secondary mt-0.5">
                PNG, JPG, WebP
              </p>
            </div>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  )
}
