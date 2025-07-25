"use client"

import type React from "react"
import { useState, useCallback, useRef, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileUp, Search, Download } from "lucide-react"
import Link from "next/link"

interface VendorOption {
  id: string
  name: string
  price: number
  availability: string // e.g., "In Stock", "2-3 Weeks", "Out of Stock"
  datasheetUrl: string
}

interface Component {
  id: string
  type: string
  value: string
  tolerance: string
  vendorOptions: VendorOption[]
  selectedVendorId?: string // ID of the selected vendor option
}

// Mock data generation
const generateMockComponents = (count: number): Component[] => {
  const componentTypes = ["Resistor", "Capacitor", "Inductor", "Diode", "Transistor", "IC"]
  const values = ["10kΩ", "100nF", "10µH", "1N4007", "BC547", "ATmega328P"]
  const tolerances = ["±1%", "±5%", "±10%", "±20%"]

  const components: Component[] = []
  for (let i = 0; i < count; i++) {
    const type = componentTypes[Math.floor(Math.random() * componentTypes.length)]
    const value = values[Math.floor(Math.random() * values.length)]
    const tolerance = tolerances[Math.floor(Math.random() * tolerances.length)]

    const vendorOptions: VendorOption[] = []
    for (let j = 0; j < Math.floor(Math.random() * 3) + 1; j++) {
      // 1 to 3 vendors
      vendorOptions.push({
        id: `vendor-${i}-${j}`,
        name: `Vendor ${String.fromCharCode(65 + j)}`,
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
      vendorOptions,
      selectedVendorId: vendorOptions.length > 0 ? vendorOptions[0].id : undefined, // Select first by default
    })
  }
  return components
}

export default function EngineerBuyerUI() {
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [recognitionProgress, setRecognitionProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [components, setComponents] = useState<Component[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")

  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files ? Array.from(event.target.files) : []
    setFiles(selectedFiles)
    if (selectedFiles.length > 0) {
      startProcessing()
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

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    const droppedFiles = event.dataTransfer.files ? Array.from(event.dataTransfer.files) : []
    setFiles(droppedFiles)
    if (droppedFiles.length > 0) {
      startProcessing()
    }
  }, [])

  const startProcessing = () => {
    setIsProcessing(true)
    setOcrProgress(0)
    setRecognitionProgress(0)
    setComponents([]) // Clear previous components

    // Simulate OCR progress
    let ocrP = 0
    const ocrInterval = setInterval(() => {
      ocrP += 10
      setOcrProgress(ocrP)
      if (ocrP >= 100) {
        clearInterval(ocrInterval)
        // Simulate Recognition progress after OCR
        let recP = 0
        const recognitionInterval = setInterval(() => {
          recP += 10
          setRecognitionProgress(recP)
          if (recP >= 100) {
            clearInterval(recognitionInterval)
            setIsProcessing(false)
            // Generate mock components after processing
            setComponents(generateMockComponents(Math.floor(Math.random() * 10) + 5)) // 5 to 14 components
          }
        }, 100)
      }
    }, 100)
  }

  const handleVendorSelection = (componentId: string, selectedVendorId: string) => {
    setComponents((prevComponents) =>
      prevComponents.map((comp) => (comp.id === componentId ? { ...comp, selectedVendorId } : comp)),
    )
  }

  const handleGenerateQuotation = () => {
    alert("Generating quotation files (PDF, Excel, JSON)... (This would be a server-side operation)")
    // In a real application, this would trigger a server-side process
    // to generate and provide download links for the files.
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
          comp.vendorOptions.some((vendor) => vendor.name.toLowerCase().includes(lowerCaseSearchTerm)),
      )
    }
    return filtered
  }, [components, filterType, searchTerm])

  const uniqueComponentTypes = useMemo(() => {
    const types = new Set(components.map((comp) => comp.type))
    return ["all", ...Array.from(types).sort()]
  }, [components])

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold mb-6 text-center">Component Recognition & Quotation</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload Schematic/BOM</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`flex flex-col items-center justify-center p-8 border-2 ${
              isDragging ? "border-primary" : "border-dashed border-gray-300"
            } rounded-lg text-center cursor-pointer transition-colors duration-200`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium mb-2">Drag & drop your files here</p>
            <p className="text-sm text-gray-500 mb-4">(Image, PDF, Schematic files supported)</p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
              accept="image/*,.pdf,.sch,.brd,.kicad_sch,.kicad_pcb"
            />
            <Button type="button" onClick={() => fileInputRef.current?.click()}>
              Browse Files
            </Button>
            {files.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">Selected: {files.map((file) => file.name).join(", ")}</div>
            )}
          </div>

          {isProcessing && (
            <div className="mt-6 space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">OCR Process</p>
                <Progress value={ocrProgress} className="w-full" />
                <p className="text-xs text-gray-500 mt-1">{ocrProgress}% Complete</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Component Recognition</p>
                <Progress value={recognitionProgress} className="w-full" />
                <p className="text-xs text-gray-500 mt-1">{recognitionProgress}% Complete</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {components.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Recognized Components</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <Input
                type="text"
                placeholder="Search components..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
                icon={<Search className="h-4 w-4 text-muted-foreground" />}
              />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full md:w-[180px]">
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
                  <TableRow>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Tolerance</TableHead>
                    <TableHead className="min-w-[200px]">Vendor Options</TableHead>
                    <TableHead className="w-[120px] text-right">Datasheet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredComponents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No components found matching your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredComponents.map((component) => {
                      const selectedVendor = component.vendorOptions.find(
                        (vendor) => vendor.id === component.selectedVendorId,
                      )
                      return (
                        <TableRow key={component.id}>
                          <TableCell className="font-medium">{component.type}</TableCell>
                          <TableCell>{component.value}</TableCell>
                          <TableCell>{component.tolerance}</TableCell>
                          <TableCell>
                            {component.vendorOptions.length > 0 ? (
                              <Select
                                value={component.selectedVendorId}
                                onValueChange={(value) => handleVendorSelection(component.id, value)}
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select Vendor" />
                                </SelectTrigger>
                                <SelectContent>
                                  {component.vendorOptions.map((vendor) => (
                                    <SelectItem key={vendor.id} value={vendor.id}>
                                      {vendor.name} - ${vendor.price.toFixed(2)} ({vendor.availability})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-muted-foreground">No vendors available</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {selectedVendor?.datasheetUrl ? (
                              <Link href={selectedVendor.datasheetUrl} target="_blank" rel="noopener noreferrer">
                                <Button variant="outline" size="sm">
                                  <Download className="h-4 w-4 mr-2" /> PDF
                                </Button>
                              </Link>
                            ) : (
                              <span className="text-muted-foreground text-sm">N/A</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {components.length > 0 && (
        <div className="flex justify-end mt-6">
          <Button size="lg" onClick={handleGenerateQuotation}>
            Generate Quotation
          </Button>
        </div>
      )}
    </div>
  )
}
