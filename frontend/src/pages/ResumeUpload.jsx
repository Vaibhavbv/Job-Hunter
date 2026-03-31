import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../hooks/useSession'

// We'll use the legacy build of pdfjs-dist for broadest compatibility
import * as pdfjsLib from 'pdfjs-dist'

// Point the worker to unpkg CDN (mirrors npm, always has latest versions)
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
}
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
}

export default function ResumeUpload() {
  const navigate = useNavigate()
  const { parseResume, loading, step, error, sessionId, jobTitles } = useSession()
  const fileInputRef = useRef(null)

  const [drag, setDrag] = useState(false)
  const [fileName, setFileName] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [parsed, setParsed] = useState(false)

  // Extract text from PDF file using pdfjs-dist
  const extractTextFromPDF = useCallback(async (file) => {
    setExtracting(true)
    setFileName(file.name)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      let fullText = ''

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items.map((item) => item.str).join(' ')
        fullText += pageText + '\n\n'
      }

      setExtractedText(fullText.trim())
      return fullText.trim()
    } catch (err) {
      console.error('PDF extraction error:', err)
      throw new Error('Failed to extract text from PDF. Please try a different file.')
    } finally {
      setExtracting(false)
    }
  }, [])

  const handleFile = useCallback(async (file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size is 10MB.')
      return
    }

    try {
      const text = await extractTextFromPDF(file)
      if (text.length < 50) {
        alert('Could not extract enough text from this PDF. Please try a different resume.')
        return
      }

      // Call parse-resume edge function
      await parseResume(text)
      setParsed(true)
    } catch (err) {
      console.error('Upload error:', err)
    }
  }, [extractTextFromPDF, parseResume])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer?.files?.[0]
    handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDrag(true)
  }, [])

  const handleDragLeave = useCallback(() => setDrag(false), [])

  const handleInputChange = useCallback((e) => {
    const file = e.target.files?.[0]
    handleFile(file)
  }, [handleFile])

  const goToDashboard = () => navigate('/ai-dashboard')

  return (
    <motion.div
      className="max-w-3xl mx-auto px-4 sm:px-6 pb-12"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={item} className="text-center py-10">
        <motion.div
          className="text-6xl mb-4"
          animate={{ rotateY: [0, 360] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
        >
          📄
        </motion.div>
        <h1 className="font-display font-bold text-3xl tracking-tight">
          Upload Your <span className="text-accent">Resume</span>
        </h1>
        <p className="text-dark-muted text-sm font-mono mt-2 max-w-md mx-auto">
          AI will analyze your resume, find matching jobs, and score each one for relevancy
        </p>
      </motion.div>

      {/* Upload Zone */}
      <motion.div variants={item}>
        <motion.div
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
            drag
              ? 'border-accent bg-accent/5 shadow-glow'
              : 'border-dark-border hover:border-accent/30 hover:bg-dark-card/50'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleInputChange}
            className="hidden"
            id="resume-upload-input"
          />

          {extracting || (loading && step === 'parsing') ? (
            <div className="flex flex-col items-center gap-4">
              <motion.div
                className="w-12 h-12 border-2 border-accent/30 border-t-accent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <div>
                <p className="text-white font-display font-bold">
                  {extracting ? 'Extracting text from PDF...' : 'AI is analyzing your resume...'}
                </p>
                <p className="text-dark-muted text-xs font-mono mt-1">
                  {extracting ? 'Reading document pages' : 'Identifying best-fit job titles'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="text-4xl mb-3 opacity-40">
                {drag ? '📥' : '📤'}
              </div>
              <p className="text-white font-display font-bold text-lg">
                {fileName ? fileName : 'Drop your resume here'}
              </p>
              <p className="text-dark-muted text-xs font-mono mt-2">
                or click to browse · PDF only · max 10MB
              </p>
            </>
          )}
        </motion.div>
      </motion.div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm font-mono"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            ✗ {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results — Job Titles */}
      <AnimatePresence>
        {parsed && jobTitles.length > 0 && (
          <motion.div
            className="mt-8 space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Success banner */}
            <div className="bg-accent/5 border border-accent/15 rounded-2xl p-5 text-center">
              <div className="text-3xl mb-2">✓</div>
              <h3 className="font-display font-bold text-lg text-accent">Resume Analyzed</h3>
              <p className="text-dark-muted text-xs font-mono mt-1">
                Session: <span className="text-white">{sessionId?.slice(0, 8)}...</span>
              </p>
            </div>

            {/* Extracted titles */}
            <div className="bg-dark-card border border-dark-border rounded-2xl p-5">
              <h3 className="font-mono text-xs text-dark-muted uppercase tracking-wider mb-4">
                Best-Fit Job Titles
              </h3>
              <div className="space-y-2">
                {jobTitles.map((title, i) => (
                  <motion.div
                    key={i}
                    className="flex items-center gap-3 px-4 py-3 bg-dark-bg rounded-xl"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <span className="w-7 h-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center font-mono font-bold text-xs">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{title}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <motion.button
              onClick={goToDashboard}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-accent to-emerald-400 text-dark-bg font-display font-bold text-lg hover:from-accent-dim hover:to-emerald-500 transition-all shadow-glow"
              whileHover={{ scale: 1.01, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              Continue to AI Dashboard →
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions */}
      <motion.div variants={item} className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: '📄', title: 'Upload PDF', desc: 'Text extracted client-side' },
          { icon: '🤖', title: 'AI Analysis', desc: 'Claude extracts job titles' },
          { icon: '🎯', title: 'Find Matches', desc: 'Fetch & score relevant jobs' },
        ].map((s, i) => (
          <motion.div
            key={i}
            className="bg-dark-card border border-dark-border rounded-xl p-4 text-center"
            whileHover={{ y: -2, borderColor: 'rgba(0, 255, 136, 0.2)' }}
          >
            <div className="text-2xl mb-2">{s.icon}</div>
            <p className="text-xs font-display font-bold">{s.title}</p>
            <p className="text-[10px] font-mono text-dark-muted mt-1">{s.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  )
}
