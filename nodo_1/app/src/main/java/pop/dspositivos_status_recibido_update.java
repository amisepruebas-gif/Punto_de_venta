package pop;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.ajustes;
import com.example.nodo_1.generales;

import adapter.adap_dispo_status_recibido_update;


public class dspositivos_status_recibido_update {
    adapter.adap_dispo_status_recibido_update update;
    public void showPopupWindow(final View view, ajustes ajustes) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.status_recibido_update, null);
        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;
        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;
        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);
        ajustes.getPopWindow(popupWindow);
        RecyclerView recyclerView = (RecyclerView) popupView.findViewById(R.id.pop_recycler_recibido_update);
        generales.recyclerVertical(recyclerView, popupView.getContext());
        update = new adap_dispo_status_recibido_update(popupView.getContext());
        recyclerView.setAdapter(update);
    }
    public void actualozar_pop(){
        update.actualizar();
    }
}
