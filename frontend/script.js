document.addEventListener('DOMContentLoaded', () => {
    let showOnlyFraud = false;

    document.getElementById('file-input').addEventListener('change', () => {
        const fileInput = document.getElementById('file-input');
        const file = fileInput.files[0];
        const fileNameSpan = document.getElementById('file-name');
        const progressContainer = document.getElementById('progress-container');

        if (file) {
            const allowedExtensions = /(\.csv|\.xlsx|\.xls)$/i;
            if (!allowedExtensions.exec(file.name)) {
                alert('Please upload a valid Excel or CSV file (XLSX, XLS, or CSV).');
                fileInput.value = '';
                fileNameSpan.textContent = '';
                progressContainer.style.display = 'none';
                return;
            }
            fileNameSpan.textContent = `${file.name}`;
            progressContainer.style.display = 'none';
        } else {
            fileNameSpan.textContent = '';
        }
    });

    document.getElementById('upload-form').addEventListener('submit', function (event) {
        event.preventDefault();
        document.getElementById('how-to-use').style.display = 'none';
        document.getElementById('processing-message').style.display = 'inline';

        setTimeout(() => {
            document.getElementById('processing-message').style.display = 'none';
            document.getElementById('results').style.display = 'block';
            document.getElementById('summary').style.display = 'block';
        }, 2000);
    });

    document.getElementById('checkFraudBtn').addEventListener('click', async (event) => {
        event.preventDefault();

        const fileInput = document.getElementById('file-input');
        const file = fileInput.files[0];
        const progressContainer = document.getElementById('progress-container');
        const processingMessage = document.getElementById('processing-message');

        if (!file) {
            alert('Please upload a file.');
            return;
        }

        progressContainer.style.display = 'block';
        processingMessage.style.display = 'inline';

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch('http://127.0.0.1:8000/upload', {
                method: 'POST',
                body: formData,
            });

            progressContainer.style.display = 'none';

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const results = await response.json();

            const resultsDiv = document.getElementById('results');
            const summaryDiv = document.getElementById('summary');
            resultsDiv.style.display = 'block';
            summaryDiv.style.display = 'block';
            processingMessage.style.display = 'none';

            let totalFraud = 0;
            let totalNonFraud = 0;

            const transactionRows = results.map(result => {
                const fraudDetected = result.Fraud ? 'Yes' : 'No';
                const fraudColor = result.Fraud ? 'background-color: #ff6b6b;' : 'background-color: #6eca8f;';

                if (result.Fraud) totalFraud++;
                else totalNonFraud++;

                return `
                    <tr class="transaction-row" data-fraud="${result.Fraud}">
                        <td>Transaction ${result.Transaction}</td>
                        <td>${result['Transaction Date Time']}</td>
                        <td>${result.City}</td>
                        <td>${result.State}</td>
                        <td>${result.Amount}</td>
                        <td style="${fraudColor}">${fraudDetected}</td>
                    </tr>
                `;
            }).join("");

            document.getElementById('total-fraud').textContent = totalFraud;
            document.getElementById('total-legit').textContent = totalNonFraud;
            document.getElementById('total-transactions').textContent = totalFraud + totalNonFraud;

            resultsDiv.innerHTML = `
                <table class="striped">
                    <thead>
                        <tr>
                            <th>Transaction</th>
                            <th>Transaction Date Time</th>
                            <th>City</th>
                            <th>State</th>
                            <th>Amount</th>
                            <th>Fraud Detected</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactionRows}
                    </tbody>
                </table>
            `;

            document.getElementById('toggleFraudBtn').addEventListener('click', () => {
                showOnlyFraud = !showOnlyFraud;

                const rows = document.querySelectorAll('.transaction-row');
                rows.forEach(row => {
                    if (showOnlyFraud && row.dataset.fraud !== "true") {
                        row.style.display = 'none';
                    } else {
                        row.style.display = 'table-row';
                    }
                });

                document.getElementById('toggleFraudBtn').textContent = showOnlyFraud ? 'Show All Transactions' : 'Show Only Fraud';
            });
        } catch (error) {
            progressContainer.style.display = 'none';
            processingMessage.style.display = 'none';
            alert('An error occurred: ' + error.message);
        }
    });
});
