$html = Get-Content 'index.html' -Raw -Encoding UTF8
$js = Get-Content 'app.js' -Raw -Encoding UTF8
$widget = $html -replace '<script src="app.js"></script>', "<script>`n$js`n</script>"
Set-Content 'widget.html' -Value $widget -Encoding UTF8
Write-Host "Widget created successfully!"
