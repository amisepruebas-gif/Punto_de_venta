package internet;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.os.Build;

public class NetworkMonitor {

    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private NetworkChangeListener listener;

    public interface NetworkChangeListener {
        void onNetworkAvailable();
        void onNetworkLost();
    }

    public NetworkMonitor(Context context, NetworkChangeListener listener) {
        this.listener = listener;
        connectivityManager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        registerNetworkCallback();
    }

    private void registerNetworkCallback() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            networkCallback = new ConnectivityManager.NetworkCallback() {
                @Override
                public void onAvailable(Network network) {
                    super.onAvailable(network);
                    listener.onNetworkAvailable();
                }

                @Override
                public void onLost(Network network) {
                    super.onLost(network);
                    listener.onNetworkLost();
                }
            };
            connectivityManager.registerDefaultNetworkCallback(networkCallback);
        } else {
            // Para versiones anteriores, podrías usar otros métodos como BroadcastReceiver
            // pero se recomienda enfocarse en versiones más recientes
        }
    }

    public void unregisterNetworkCallback() {
        if (connectivityManager != null && networkCallback != null) {
            connectivityManager.unregisterNetworkCallback(networkCallback);
        }
    }
}
