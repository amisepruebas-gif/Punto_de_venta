package pop;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import com.example.nodo_1.R;
import com.example.nodo_1.principal;

public class pop_but_opcionTicket {
    public void showPopupWindow(final View view , principal principal) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_opc_ticket, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);

        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        ((Button)popupView.findViewById(R.id.button39)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if(((EditText)popupView.findViewById(R.id.editTextText8)).length() > 0){
                    if(((EditText)popupView.findViewById(R.id.editTextText8)).getText().toString().equals("7849")){
                        principal.adminInit_corte();
                        popupWindow.dismiss();
                    }
                }
            }
        });
    }
}
