"use client"

import type React from "react"
import { useState, useCallback, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileUp, Search, Download, CheckCircle, XCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

interface VendorOption {
  id: string
  name: string
  partNumber: string
  price: number
  availability: string // e.g., "In Stock", "2-3 Weeks", "Out of Stock"
  datasheetUrl: string
}

interface Component {
  id: string
  type: string
  value: string
  tolerance: string
  identifier: string // e.g., R1, C10
  vendorOptions: VendorOption[]
  selectedVendorId?: string // ID of the selected vendor option
}

interface QuotationSummary {
  totalParts: number
  totalCost: number
  pdfUrl: string
  excelUrl: string
  jsonUrl: string
}

enum Step {
  Upload = "upload",
  Recognition = "recognition",
  Review = "review",
  Confirmation = "confirmation",
}

// Mock API functions
const mockApi = {
  uploadFile: async (file: File): Promise<{ uploadId: string }> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        if (file.name.includes("error")) {
          throw new Error("Simulated upload error for 'error' file.")
        }
        resolve({ uploadId: `upload-${Date.now()}` })
      }, 1000)
    })
  },

  getProcessingStatus: async (
    uploadId: string,
  ): Promise<{ ocrProgress: number; recognitionProgress: number; status: "pending" | "completed" | "failed" }> => {
    return new Promise((resolve) => {
      // Simulate varying progress
      const ocrP = Math.min(100, Math.floor(Math.random() * 100) + 1)
      const recP = Math.min(100, Math.floor(Math.random() * 100) + 1)
      const status = ocrP === 100 && recP === 100 ? "completed" : "pending"
      setTimeout(() => {
        resolve({ ocrProgress: ocrP, recognitionProgress: recP, status })
      }, 500)
    })
  },

  getComponents: async (uploadId: string): Promise<Component[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const componentTypes = ["Resistor", "Capacitor", "Inductor", "Diode", "Transistor", "IC"]
        const values = ["10kΩ", "100nF", "10µH", "1N4007", "BC547", "ATmega328P"]
        const tolerances = ["±1%", "±5%", "±10%", "±20%"]

        const components: Component[] = []
        const numComponents = Math.floor(Math.random() * 10) + 5 // 5 to 14 components
        for (let i = 0; i < numComponents; i++) {
          const type = componentTypes[Math.floor(Math.random() * componentTypes.length)]
          const value = values[Math.floor(Math.random() * values.length)]
          const tolerance = tolerances[Math.floor(Math.random() * tolerances.length)]
          const identifier = `${type.charAt(0)}${i + 1}`

          const vendorOptions: VendorOption[] = []
          const numVendors = Math.floor(Math.random() * 3) + 1 // 1 to 3 vendors
          for (let j = 0; j < numVendors; j++) {
            vendorOptions.push({
              id: `vendor-${i}-${j}`,
              name: `Vendor ${String.fromCharCode(65 + j)}`,
              partNumber: `${type.slice(0, 2).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
              price: Number.parseFloat((Math.random() * 0.5 + 0.01).toFixed(2)), // $0.01 to $0.51
              availability: ["In Stock", "2-3 Weeks", "Out of Stock"][Math.floor(Math.random() * 3)],
              datasheetUrl: `/placeholder.pdf?query=datasheet-for-${type}-${value}`,
            })
          }

          components.push({
            id: `comp-${i}`,
            type,
            value,
            tolerance,
            identifier,
            vendorOptions,
            selectedVendorId: vendorOptions.length > 0 ? vendorOptions[0].id : undefined, // Select first by default
          })
        }
        resolve(components)
      }, 2000)
    })
  },

  getVendors: async (componentId: string): Promise<VendorOption[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        // This function is mostly for demonstration, as vendor options are already in getComponents
        // In a real app, this would fetch more detailed vendor info for a specific component
        resolve([]) // Return empty as it's already in component data
      }, 500)
    })
  },

  generateQuotation: async (selectedComponents: Component[]): Promise<QuotationSummary> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const totalParts = selectedComponents.length
        const totalCost = selectedComponents.reduce((sum, comp) => {
          const selectedVendor = comp.vendorOptions.find((v) => v.id === comp.selectedVendorId)
          return sum + (selectedVendor ? selectedVendor.price : 0)
        }, 0)

        if (totalParts === 0) {
          reject(new Error("No components selected for quotation."))
          return
        }

        resolve({
          totalParts,
          totalCost: Number.parseFloat(totalCost.toFixed(2)),
          pdfUrl: "/quotation.pdf?format=pdf",
          excelUrl: "/quotation.xlsx?format=excel",
          jsonUrl: "/quotation.json?format=json",
        })
      }, 2000)
    })
  },
}

export default function EngineerBuyerUI() {
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState<Step>(Step.Upload)
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [recognitionProgress, setRecognitionProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [components, setComponents] = useState<Component[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [quotationSummary, setQuotationSummary] = useState<QuotationSummary | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files ? Array.from(event.target.files) : []
    setFiles(selectedFiles)
    if (selectedFiles.length > 0) {
      await startProcessing(selectedFiles[0]) // Assuming single file upload for simplicity
    }
  }

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    const droppedFiles = event.dataTransfer.files ? Array.from(event.dataTransfer.files) : []
    setFiles(droppedFiles)
    if (droppedFiles.length > 0) {
      await startProcessing(droppedFiles[0]) // Assuming single file upload for simplicity
    }
  }, [])

  const startProcessing = async (file: File) => {
    setIsProcessing(true)
    setOcrProgress(0)
    setRecognitionProgress(0)
    setComponents([])
    setUploadId(null)
    setQuotationSummary(null)
    setCurrentStep(Step.Upload) // Ensure we are on the upload screen for progress

    try {
      const uploadResponse = await mockApi.uploadFile(file)
      setUploadId(uploadResponse.uploadId)
      toast({
        title: "File Uploaded",
        description: `File '${file.name}' uploaded successfully. Processing started.`,
        variant: "default",
      })

      let statusCompleted = false
      const pollInterval = setInterval(async () => {
        const status = await mockApi.getProcessingStatus(uploadResponse.uploadId)
        setOcrProgress(status.ocrProgress)
        setRecognitionProgress(status.recognitionProgress)

        if (status.status === "completed") {
          clearInterval(pollInterval)
          statusCompleted = true
          const fetchedComponents = await mockApi.getComponents(uploadResponse.uploadId)
          setComponents(fetchedComponents)
          setCurrentStep(Step.Recognition)
          setIsProcessing(false)
          toast({
            title: "Processing Complete",
            description: "Components recognized successfully!",
            variant: "default",
          })
        } else if (status.status === "failed") {
          clearInterval(pollInterval)
          setIsProcessing(false)
          toast({
            title: "Processing Failed",
            description: "Failed to recognize components. Please try again.",
            variant: "destructive",
          })
          setCurrentStep(Step.Upload) // Go back to upload on failure
        }
      }, 500) // Poll every 0.5 seconds

      // Fallback to stop polling if it takes too long (e.g., 10 seconds)
      setTimeout(() => {
        if (!statusCompleted) {
          clearInterval(pollInterval)
          setIsProcessing(false)
          toast({
            title: "Processing Timeout",
            description: "Processing took too long. Please try again.",
            variant: "destructive",
          })
          setCurrentStep(Step.Upload)
        }
      }, 10000)
    } catch (error: any) {
      setIsProcessing(false)
      toast({
        title: "Upload Failed",
        description: error.message || "Could not upload file. Please try again.",
        variant: "destructive",
      })
      setCurrentStep(Step.Upload)
    }
  }

  const handleVendorSelection = (componentId: string, selectedVendorId: string) => {
    setComponents((prevComponents) =>
      prevComponents.map((comp) => (comp.id === componentId ? { ...comp, selectedVendorId } : comp)),
    )
  }

  const handleGenerateQuotation = async () => {
    setIsProcessing(true)
    try {
      const summary = await mockApi.generateQuotation(components)
      setQuotationSummary(summary)
      setCurrentStep(Step.Confirmation)
      toast({
        title: "Quotation Generated",
        description: "Your quotation is ready for download.",
        variant: "default",
      })
    } catch (error: any) {
      toast({
        title: "Quotation Generation Failed",
        description: error.message || "Could not generate quotation. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleStartNewQuote = () => {
    setFiles([])
    setOcrProgress(0)
    setRecognitionProgress(0)
    setIsProcessing(false)
    setUploadId(null)
    setComponents([])
    setSearchTerm("")
    setFilterType("all")
    setQuotationSummary(null)
    setCurrentStep(Step.Upload)
  }

  const filteredComponents = useMemo(() => {
    let filtered = components

    if (filterType !== "all") {
      filtered = filtered.filter((comp) => comp.type === filterType)
    }

    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (comp) =>
          comp.type.toLowerCase().includes(lowerCaseSearchTerm) ||
          comp.value.toLowerCase().includes(lowerCaseSearchTerm) ||
          comp.tolerance.toLowerCase().includes(lowerCaseSearchTerm) ||
          comp.identifier.toLowerCase().includes(lowerCaseSearchTerm) ||
          comp.vendorOptions.some((vendor) => vendor.name.toLowerCase().includes(lowerCaseSearchTerm)),
      )
    }
    return filtered
  }, [components, filterType, searchTerm])

  const uniqueComponentTypes = useMemo(() => {
    const types = new Set(components.map((comp) => comp.type))
    return ["all", ...Array.from(types).sort()]
  }, [components])

  const selectedComponentsForReview = useMemo(() => {
    return components.filter((comp) => comp.selectedVendorId)
  }, [components])

  const totalReviewCost = useMemo(() => {
    return selectedComponentsForReview
      .reduce((sum, comp) => {
        const selectedVendor = comp.vendorOptions.find((v) => v.id === comp.selectedVendorId)
        return sum + (selectedVendor ? selectedVendor.price : 0)
      }, 0)
      .toFixed(2)
  }, [selectedComponentsForReview])

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 font-sans">
      <h1 className="text-3xl font-bold mb-6 text-center text-miracle-darkBlue">Component Recognition & Quotation</h1>

      {currentStep === Step.Upload && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-miracle-mediumBlue">Upload Schematic/BOM</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`flex flex-col items-center justify-center p-8 border-2 ${
                isDragging ? "border-miracle-lightBlue" : "border-dashed border-miracle-lightGrey"
              } rounded-lg text-center cursor-pointer transition-colors duration-200`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="w-12 h-12 text-miracle-darkGrey mb-4" />
              <p className="text-lg font-medium mb-2 text-miracle-black">Drag & drop your files here</p>
              <p className="text-sm text-miracle-darkGrey mb-4">(Image, PDF, Schematic files supported)</p>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                multiple={false} // Only allow single file upload for simplicity of mock API
                accept="image/*,.pdf,.sch,.brd,.kicad_sch,.kicad_pcb"
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-miracle-darkBlue hover:bg-miracle-mediumBlue text-miracle-white"
              >
                Browse Files
              </Button>
              {files.length > 0 && <div className="mt-4 text-sm text-miracle-darkGrey">Selected: {files[0]?.name}</div>}
            </div>

            {isProcessing && (
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2 text-miracle-black">OCR Process</p>
                  <Progress value={ocrProgress} className="w-full bg-miracle-lightGrey" />
                  <p className="text-xs text-miracle-darkGrey mt-1">{ocrProgress}% Complete</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2 text-miracle-black">Component Recognition</p>
                  <Progress value={recognitionProgress} className="w-full bg-miracle-lightGrey" />
                  <p className="text-xs text-miracle-darkGrey mt-1">{recognitionProgress}% Complete</p>
                </div>
                <div className="flex items-center justify-center text-miracle-mediumBlue">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Processing...</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {currentStep === Step.Recognition && components.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-miracle-mediumBlue">Recognized Components</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <Input
                type="text"
                placeholder="Search components..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 border-miracle-lightGrey focus:border-miracle-lightBlue"
                icon={<Search className="h-4 w-4 text-miracle-darkGrey" />}
              />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full md:w-[180px] border-miracle-lightGrey focus:border-miracle-lightBlue">
                  <SelectValue placeholder="Filter by Type" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueComponentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type === "all" ? "All Types" : type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-miracle-lightGrey">
                    <TableHead className="w-[100px] text-miracle-black">Identifier</TableHead>
                    <TableHead className="w-[100px] text-miracle-black">Type</TableHead>
                    <TableHead className="text-miracle-black">Value</TableHead>
                    <TableHead className="text-miracle-black">Tolerance</TableHead>
                    <TableHead className="min-w-[250px] text-miracle-black">Vendor Options</TableHead>
                    <TableHead className="w-[120px] text-right text-miracle-black">Datasheet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComponents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-miracle-darkGrey">
                        No components found matching your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredComponents.map((component) => {
                      const selectedVendor = component.vendorOptions.find(
                        (vendor) => vendor.id === component.selectedVendorId,
                      )
                      const isUnavailable = selectedVendor?.availability === "Out of Stock"
                      return (
                        <TableRow key={component.id} className={isUnavailable ? "bg-miracle-red/10" : ""}>
                          <TableCell className="font-medium text-miracle-black">{component.identifier}</TableCell>
                          <TableCell className="text-miracle-black">{component.type}</TableCell>
                          <TableCell className="text-miracle-black">{component.value}</TableCell>
                          <TableCell className="text-miracle-black">{component.tolerance}</TableCell>
                          <TableCell>
                            {component.vendorOptions.length > 0 ? (
                              <Select
                                value={component.selectedVendorId}
                                onValueChange={(value) => handleVendorSelection(component.id, value)}
                              >
                                <SelectTrigger
                                  className={`w-full ${isUnavailable ? "border-miracle-red text-miracle-red" : "border-miracle-lightGrey"}`}
                                >
                                  <SelectValue placeholder="Select Vendor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {component.vendorOptions.map((vendor) => (
                                    <SelectItem
                                      key={vendor.id}
                                      value={vendor.id}
                                      className={vendor.availability === "Out of Stock" ? "text-miracle-red" : ""}
                                    >
                                      {vendor.name} - ${vendor.price.toFixed(2)} ({vendor.availability})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-miracle-darkGrey text-sm">No vendors available</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {selectedVendor?.datasheetUrl ? (
                              <Link href={selectedVendor.datasheetUrl} target="_blank" rel="noopener noreferrer">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-miracle-lightBlue text-miracle-lightBlue hover:bg-miracle-lightBlue hover:text-miracle-white bg-transparent"
                                >
                                  <Download className="h-4 w-4 mr-2" /> PDF
                                </Button>
                              </Link>
                            ) : (
                              <span className="text-miracle-darkGrey text-sm">N/A</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-between mt-6">
              <Button
                onClick={() => setCurrentStep(Step.Upload)}
                variant="outline"
                className="border-miracle-darkBlue text-miracle-darkBlue hover:bg-miracle-darkBlue hover:text-miracle-white"
              >
                Back to Upload
              </Button>
              <Button
                onClick={() => setCurrentStep(Step.Review)}
                className="bg-miracle-darkBlue hover:bg-miracle-mediumBlue text-miracle-white"
              >
                Review Quotation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === Step.Review && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-miracle-mediumBlue">Quotation Review</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedComponentsForReview.length === 0 ? (
              <div className="text-center text-miracle-darkGrey py-8">
                No components selected for quotation. Please go back and select vendors.
              </div>
            ) : (
              <div className="overflow-x-auto mb-6">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-miracle-lightGrey">
                      <TableHead className="text-miracle-black">Identifier</TableHead>
                      <TableHead className="text-miracle-black">Type</TableHead>
                      <TableHead className="text-miracle-black">Value</TableHead>
                      <TableHead className="text-miracle-black">Selected Vendor</TableHead>
                      <TableHead className="text-right text-miracle-black">Price</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedComponentsForReview.map((component) => {
                      const selectedVendor = component.vendorOptions.find((v) => v.id === component.selectedVendorId)
                      return (
                        <TableRow key={component.id}>
                          <TableCell className="font-medium text-miracle-black">{component.identifier}</TableCell>
                          <TableCell className="text-miracle-black">{component.type}</TableCell>
                          <TableCell className="text-miracle-black">{component.value}</TableCell>
                          <TableCell className="text-miracle-black">
                            {selectedVendor ? `${selectedVendor.name} (${selectedVendor.partNumber})` : "N/A"}
                          </TableCell>
                          <TableCell className="text-right text-miracle-black">
                            {selectedVendor ? `$${selectedVendor.price.toFixed(2)}` : "$0.00"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex justify-end items-center gap-4 text-lg font-semibold text-miracle-black">
              <span>Total Cost:</span>
              <span className="text-miracle-darkBlue">${totalReviewCost}</span>
            </div>
            <div className="flex justify-between mt-6">
              <Button
                onClick={() => setCurrentStep(Step.Recognition)}
                variant="outline"
                className="border-miracle-darkBlue text-miracle-darkBlue hover:bg-miracle-darkBlue hover:text-miracle-white"
              >
                Back to Components
              </Button>
              <Button
                onClick={handleGenerateQuotation}
                disabled={isProcessing || selectedComponentsForReview.length === 0}
                className="bg-miracle-red hover:bg-miracle-red/80 text-miracle-white"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                  </>
                ) : (
                  "Generate Quotation"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === Step.Confirmation && quotationSummary && (
        <Card className="mb-6 text-center">
          <CardHeader>
            <CardTitle className="text-miracle-mediumBlue">Quotation Generated Successfully!</CardTitle>
          </CardHeader>
          <CardContent>
            <CheckCircle className="w-20 h-20 text-miracle-lightBlue mx-auto mb-6" />
            <p className="text-lg font-medium mb-4 text-miracle-black">
              Your quotation for {quotationSummary.totalParts} parts, totaling ${quotationSummary.totalCost.toFixed(2)},
              is ready.
            </p>
            <div className="flex flex-col md:flex-row justify-center gap-4 mb-6">
              <Link href={quotationSummary.pdfUrl} target="_blank" rel="noopener noreferrer">
                <Button className="bg-miracle-darkBlue hover:bg-miracle-mediumBlue text-miracle-white">
                  <Download className="h-4 w-4 mr-2" /> Download PDF
                </Button>
              </Link>
              <Link href={quotationSummary.excelUrl} target="_blank" rel="noopener noreferrer">
                <Button className="bg-miracle-darkBlue hover:bg-miracle-mediumBlue text-miracle-white">
                  <Download className="h-4 w-4 mr-2" /> Download Excel
                </Button>
              </Link>
              <Link href={quotationSummary.jsonUrl} target="_blank" rel="noopener noreferrer">
                <Button className="bg-miracle-darkBlue hover:bg-miracle-mediumBlue text-miracle-white">
                  <Download className="h-4 w-4 mr-2" /> Download JSON
                </Button>
              </Link>
            </div>
            <Button
              onClick={handleStartNewQuote}
              variant="outline"
              className="border-miracle-darkBlue text-miracle-darkBlue hover:bg-miracle-darkBlue hover:text-miracle-white bg-transparent"
            >
              Start New Quote
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Error/Status Handling (using useToast, but showing a fallback for demonstration) */}
      {currentStep !== Step.Confirmation && !isProcessing && components.length === 0 && files.length > 0 && (
        <div className="text-center text-miracle-red py-8">
          <XCircle className="w-12 h-12 mx-auto mb-4" />
          <p className="text-lg font-medium">No components recognized or an error occurred.</p>
          <p className="text-sm text-miracle-darkGrey">
            Please ensure the file is clear and supported, then try again.
          </p>
          <Button
            onClick={handleStartNewQuote}
            className="mt-4 bg-miracle-red hover:bg-miracle-red/80 text-miracle-white"
          >
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}
