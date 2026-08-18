<?php
require __DIR__ . '/../vendor/autoload.php';

use Smalot\PdfParser\Parser as PdfParser;
use PhpOffice\PhpWord\IOFactory as WordIOFactory;
use PhpOffice\PhpSpreadsheet\IOFactory as ExcelIOFactory;

$documentsDir = __DIR__ . '/../Data/documents/';
$cacheFile = __DIR__ . '/../Data/documents_cache.json';

if (!is_dir($documentsDir)) {
    die("Documents folder not found: $documentsDir\n");
}

$extracted = [];
$files = scandir($documentsDir);

foreach ($files as $file) {
    $path = $documentsDir . $file;
    if (!is_file($path)) continue;

    $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
    $text = '';

    try {
        if ($ext === 'pdf') {
            $parser = new PdfParser();
            $pdf = $parser->parseFile($path);
            $text = $pdf->getText();

        } elseif ($ext === 'docx') {
            $phpWord = WordIOFactory::load($path);
            foreach ($phpWord->getSections() as $section) {
                foreach ($section->getElements() as $element) {
                    if (method_exists($element, 'getText')) {
                        $text .= $element->getText() . "\n";
                    } elseif (method_exists($element, 'getElements')) {
                        foreach ($element->getElements() as $childElement) {
                            if (method_exists($childElement, 'getText')) {
                                $text .= $childElement->getText() . "\n";
                            }
                        }
                    }
                }
            }

        } elseif ($ext === 'xlsx') {
            $spreadsheet = ExcelIOFactory::load($path);
            foreach ($spreadsheet->getAllSheets() as $sheet) {
                foreach ($sheet->getRowIterator() as $row) {
                    $rowText = [];
                    foreach ($row->getCellIterator() as $cell) {
                        $val = $cell->getValue();
                        if ($val !== null && $val !== '') {
                            $rowText[] = $val;
                        }
                    }
                    if (!empty($rowText)) {
                        $text .= implode(' | ', $rowText) . "\n";
                    }
                }
            }
        } else {
            continue;
        }

        if (trim($text) !== '') {
            $extracted[] = [
                'id' => 'DOC_' . pathinfo($file, PATHINFO_FILENAME),
                'text' => trim($text),
                'source_file' => $file,
                'last_updated' => date('Y-m-d', filemtime($path))
            ];
            echo "Extracted: $file\n";
        }

    } catch (Exception $e) {
        echo "Failed to extract $file: " . $e->getMessage() . "\n";
    }
}

file_put_contents($cacheFile, json_encode($extracted, JSON_PRETTY_PRINT));
echo "\nDone. Extracted " . count($extracted) . " documents to $cacheFile\n";