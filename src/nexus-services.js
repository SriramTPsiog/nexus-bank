const project = 'nexus-bank-79767';
const apiKey = import.meta.env.VITE_NEXUS_WEB_API_KEY || 'AIzaSyA2y2A0dyqeoMXpkUePrjDl6IXVfzhYHKE';
const service = 'https://asia-south1-' + project + '.cloudfunctions.net/nexusServices';

export async function identity(action, data) {
  const response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:' + action + '?key=' + apiKey, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Firebase sign-in failed.');
  return result;
}
export async function callService(token, path, method = 'GET', data) {
  let response;
  try {
    response = await fetch(service + path, { method, headers:{ Authorization:'Bearer ' + token, ...(data && {'Content-Type':'application/json'}) },
      body:data && JSON.stringify(data), cache:'no-store', redirect:'error' });
  } catch { throw new Error('Could not reach Nexus Firebase services. Check the function deployment and your connection.'); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Nexus service returned HTTP ' + response.status);
  return result;
}
export function paise(input) {
  if (!/^\d+(\.\d{1,2})?$/.test(input)) throw new Error('Enter a positive INR amount with up to two decimal places.');
  const [whole, fraction = ''] = input.split('.');
  const value = Number(whole)*100 + Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Enter a valid positive amount.');
  return value;
}
export async function upload(file) {
  if (!file?.size || file.size > 262144) throw new Error('Select a mock document up to 256 KiB.');
  const data = await new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the document.'));
    reader.readAsDataURL(file);
  });
  return { type:file.type, data };
}
