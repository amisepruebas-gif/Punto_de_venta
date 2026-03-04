package propiedades_articulos;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import androidx.recyclerview.widget.RecyclerView;

import com.example.nodo_1.R;
import com.example.nodo_1.generales;

import org.json.JSONArray;

import adapter.adap_simple_texto;


public class pop_art_por_precio_vista_dos {
    public void showPopupWindow(final View view, JSONArray array) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.sliding_cant_id_por_precio, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        RecyclerView recyclerView_dos = popupView.findViewById(R.id.recyclerpoplistacantidadpreciostres);
        generales.recyclerVertical(recyclerView_dos, popupView.getContext());
        adap_simple_texto adapSegundo = new adap_simple_texto();
        recyclerView_dos.setAdapter(adapSegundo);
        adapSegundo.add(array);
    }
}
