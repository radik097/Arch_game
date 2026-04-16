import React, { useState } from 'react';

// Use CDN import for browser WebTorrent
// @ts-ignore
import WebTorrent from 'https://esm.sh/webtorrent';

const defaultMagnet = 'magnet:?xt=urn:btih:...'; // Replace with a real magnet link or leave blank

export const WebTorrentTab: React.FC = () => {
  const [magnetURI, setMagnetURI] = useState(defaultMagnet);
  const [files, setFiles] = useState<any[]>([]);
  const [status, setStatus] = useState('Idle');

  const handleDownload = () => {
    setStatus('Starting...');
    const client = new WebTorrent();
    client.add(magnetURI, (torrent: any) => {
      setStatus('Downloading: ' + torrent.infoHash);
      setFiles(torrent.files);
      torrent.on('done', () => setStatus('Download complete!'));
    });
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>WebTorrent Demo</h2>
      <input
        type="text"
        value={magnetURI}
        onChange={e => setMagnetURI(e.target.value)}
        style={{ width: '80%' }}
        placeholder="Enter magnet URI"
      />
      <button onClick={handleDownload} style={{ marginLeft: 8 }}>Download</button>
      <div style={{ marginTop: 16 }}>
        <strong>Status:</strong> {status}
      </div>
      <ul>
        {files.map((file, idx) => (
          <li key={idx}>
            {file.name} {' '}
            <button onClick={() => file.appendTo('body')}>Show</button>
            <button onClick={() => file.getBlob((err: any, blob: Blob) => {
              if (!err) {
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
              }
            })}>Download</button>
          </li>
        ))}
      </ul>
    </div>
  );
};
